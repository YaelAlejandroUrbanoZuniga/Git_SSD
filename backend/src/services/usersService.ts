import type { Prisma, PrismaClient } from '@prisma/client';
import { APP_ROLES, type AppRole } from '../domain/constants';
import { BusinessRuleError, NotFoundError, ValidationError } from '../domain/errors';
import { EMAIL_RE } from '../domain/textValidation';

type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

function toUserDTO(u: UserWithRole) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    supervisorName: u.supervisorName,
    role: u.role.name,
  };
}

/** Local part of an email, lowercased (the username convention). */
function usernameFromEmail(email: string): string {
  return email.trim().toLowerCase().split('@')[0];
}

/**
 * Placeholder username used until a person's first real login replaces it with
 * their true AD netid. The 'pending:' prefix makes it unmistakable from a real
 * netid and queryable (WHERE Username LIKE 'pending:%' = nobody on this row has
 * ever signed in). We can't guess the netid from the email (the corporate netid,
 * e.g. 'GZJGZE', bears no relation to 'yael.urbano@nexteer.com'), so login
 * matches pre-provisioned users by EMAIL and stamps the real netid then.
 */
export function pendingUsername(email: string): string {
  return `pending:${usernameFromEmail(email)}`;
}

/** "john.doe" → "John Doe" — a display fallback until the real AD name lands. */
function capitalizeUsername(username: string): string {
  return username
    .split(/[.\s_-]+/)
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

/**
 * Users for the User Management module. Guest rows are intentionally hidden:
 * a Guest is anyone who authenticated against AD but has not yet been granted
 * an operational role, so the list would fill with people who merely logged in
 * once. They still exist in the DB (login, auth and every other user query are
 * unaffected — this filter lives only here). Adding a Guest through
 * `createUser` reclaims that same hidden row (see below), so they reappear the
 * moment they are given a real role.
 */
export async function listUsers(prisma: PrismaClient) {
  const rows = await prisma.user.findMany({
    where: { role: { is: { name: { not: 'Guest' } } } },
    include: { role: true },
    orderBy: { displayName: 'asc' },
  });
  return rows.map(toUserDTO);
}

interface CreateUserInput {
  email: string;
  role: string;
}

/** Pre-provisions a user's role before their first AD login. */
export async function createUser(prisma: PrismaClient, input: CreateUserInput) {
  const email = (input.email ?? '').trim();
  if (!EMAIL_RE.test(email)) {
    throw new ValidationError(`Invalid email: ${input.email}`);
  }
  if (!APP_ROLES.includes(input.role as AppRole)) {
    throw new ValidationError(`Unknown role "${input.role}". Allowed: ${APP_ROLES.join(', ')}`);
  }
  const username = usernameFromEmail(email);

  const clash = await prisma.user.findFirst({
    where: { OR: [{ username }, { email }] },
    include: { role: true },
  });
  if (clash) {
    // Reclaim a Guest instead of rejecting them. Someone who already signed in
    // as Guest (or was pre-provisioned as Guest) has a row in C_User keyed by
    // the same email; "adding" them with a real role must promote that very row
    // — not fail as a duplicate, and not create a second row. We keep their
    // `username` (may already be the true AD netid stamped at first login, not
    // the `pending:` placeholder) and `displayName` (may already come from AD);
    // only the role changes. Guarded to an EMAIL match: a bare username
    // collision (rare, and not the same person) stays a real 409.
    if (clash.email != null && clash.email === email && clash.role.name === 'Guest') {
      const promoted = await prisma.user.update({
        where: { id: clash.id },
        data: { role: { connect: { name: input.role } } },
        include: { role: true },
      });
      return { ...toUserDTO(promoted), promotedFromGuest: true };
    }
    // Any other clash is a genuine conflict (a real non-Guest user, or a
    // username collision) — resolve it by editing that row from the list.
    throw new BusinessRuleError(
      clash.email === email
        ? `A user with email ${email} already exists`
        : `A user with username ${username} already exists`,
    );
  }

  const created = await prisma.user.create({
    data: {
      // id defaults to cuid() at the DB layer.
      // Placeholder until the person's first login stamps their real AD netid;
      // the email-derived local part is NOT the real netid (see pendingUsername).
      username: pendingUsername(email),
      email,
      // Self-corrects to the real AD name on first login.
      displayName: capitalizeUsername(username),
      adObjectId: null,
      role: { connect: { name: input.role } },
    },
    include: { role: true },
  });
  return toUserDTO(created);
}

/** Changes a user's role. SSD rows can only be reassigned in the database. */
export async function updateUserRole(prisma: PrismaClient, id: string, role: string) {
  if (!APP_ROLES.includes(role as AppRole)) {
    throw new ValidationError(`Unknown role "${role}". Allowed: ${APP_ROLES.join(', ')}`);
  }
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw new NotFoundError(`User ${id} not found`);

  // SSD is the highest-privilege role: once granted it can only be changed from
  // the database directly, never from the app — not even by another SSD. This
  // stops anyone holding SSD access from escalating or demoting SSD-level peers.
  // ValidationError (400) matches the sibling last-SSD guard's status code.
  if (existing.role.name === 'SSD') {
    throw new ValidationError('SSD users can only be reassigned by modifying the database directly. Contact the system administrator.');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: { connect: { name: role } } },
    include: { role: true },
  });
  return toUserDTO(updated);
}

/** Deletes a user. SSD rows can only be removed from the database. */
export async function deleteUser(prisma: PrismaClient, id: string) {
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw new NotFoundError(`User ${id} not found`);

  // SSD users are managed exclusively from the database (see updateUserRole).
  // The app never deletes them, regardless of how many SSDs remain.
  // ValidationError (400) matches the sibling last-SSD guard's status code.
  if (existing.role.name === 'SSD') {
    throw new ValidationError('SSD users cannot be deleted from the application. Remove them from the database directly.');
  }

  await prisma.user.delete({ where: { id } });
}
