import type { Prisma, PrismaClient } from '@prisma/client';
import { APP_ROLES, type AppRole } from '../domain/constants';
import { BusinessRuleError, NotFoundError, ValidationError } from '../domain/errors';

type UserWithRole = Prisma.UserGetPayload<{ include: { role: true } }>;

function toUserDTO(u: UserWithRole) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
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

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function listUsers(prisma: PrismaClient) {
  const rows = await prisma.user.findMany({
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
  });
  if (clash) {
    // 409 — the user already exists (username or email collision).
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

async function countSsd(prisma: PrismaClient): Promise<number> {
  return prisma.user.count({ where: { role: { is: { name: 'SSD' } } } });
}

/** Changes a user's role. Refuses to demote the last remaining SSD (master). */
export async function updateUserRole(prisma: PrismaClient, id: string, role: string) {
  if (!APP_ROLES.includes(role as AppRole)) {
    throw new ValidationError(`Unknown role "${role}". Allowed: ${APP_ROLES.join(', ')}`);
  }
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw new NotFoundError(`User ${id} not found`);

  if (existing.role.name === 'SSD' && role !== 'SSD' && (await countSsd(prisma)) <= 1) {
    throw new ValidationError('Cannot demote the last SSD user');
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { role: { connect: { name: role } } },
    include: { role: true },
  });
  return toUserDTO(updated);
}

/** Deletes a user. Refuses to remove the last remaining SSD (master). */
export async function deleteUser(prisma: PrismaClient, id: string) {
  const existing = await prisma.user.findUnique({ where: { id }, include: { role: true } });
  if (!existing) throw new NotFoundError(`User ${id} not found`);

  if (existing.role.name === 'SSD' && (await countSsd(prisma)) <= 1) {
    throw new ValidationError('Cannot delete the last SSD user');
  }

  await prisma.user.delete({ where: { id } });
}
