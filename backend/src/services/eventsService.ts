import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import { NotFoundError, ValidationError } from '../domain/errors';
import type { AuthUser } from '../middleware/auth';
import { createSupplier, type CreateSupplierInput } from './suppliersService';
import { notifySsdTeam } from './notificationsService';

const eventInclude = {
  productCategory: true,
  supplierEntries: true,
  b2bMeetings: true,
  notes: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.EventInclude;

type EventWithRelations = Prisma.EventGetPayload<{ include: typeof eventInclude }>;

function toEventDTO(e: EventWithRelations) {
  return {
    id: e.id,
    name: e.name,
    dateStart: e.dateStart,
    dateEnd: e.dateEnd,
    location: e.location,
    organizer: e.organizer,
    ...(e.contactName != null ? { contactName: e.contactName } : {}),
    ...(e.contactEmail != null ? { contactEmail: e.contactEmail } : {}),
    ...(e.contactPhone != null ? { contactPhone: e.contactPhone } : {}),
    status: e.status,
    description: e.description,
    type: e.productCategory.name,
    // computed — kept consistent with entries by construction
    suppliersRegistered: e.supplierEntries.length,
    supplierEntries: e.supplierEntries.map(en => ({
      supplierId: en.supplierId,
      b2bMeeting: en.b2bMeeting,
      status: en.status,
      result: en.result,
    })),
    b2bMeetings: e.b2bMeetings.map(m => ({
      time: m.time,
      stand: m.stand,
      companyName: m.companyName,
      supplierId: m.supplierId ?? '',
      commodity: m.commodity,
      attendeeManager: m.attendeeManager,
      attendeeBuyer: m.attendeeBuyer,
      duration: m.duration,
      status: m.status,
    })),
    objective: e.objective,
    topCommodity: e.topCommodity,
    topCountry: e.topCountry,
    notes: e.notes.map(n => ({
      id: n.id, text: n.text, author: n.author, role: n.role, date: n.date,
    })),
  };
}

export async function listEvents(prisma: PrismaClient) {
  const rows = await prisma.event.findMany({ include: eventInclude, orderBy: { dateStart: 'asc' } });
  return rows.map(toEventDTO);
}

export async function getEventById(prisma: PrismaClient, id: string) {
  const row = await prisma.event.findUnique({ where: { id }, include: eventInclude });
  if (!row) throw new NotFoundError(`Event ${id} not found`);
  return toEventDTO(row);
}

export interface EventInput {
  name: string;
  dateStart: string;
  dateEnd: string;
  location: string;
  organizer: string;
  contactName?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  status: 'Upcoming' | 'Ongoing' | 'Completed' | 'Canceled';
  description?: string;
  type: 'Direct' | 'Indirect';
  objective?: string;
  topCommodity?: string;
  topCountry?: string;
}

export async function createEvent(prisma: PrismaClient, input: EventInput) {
  if (!input.name?.trim()) throw new ValidationError('Event name is required');
  const row = await prisma.event.create({
    data: {
      id: `evt-${randomUUID()}`,
      name: input.name.trim(),
      dateStart: input.dateStart,
      dateEnd: input.dateEnd,
      location: input.location,
      organizer: input.organizer,
      contactName: input.contactName ?? null,
      contactEmail: input.contactEmail ?? null,
      contactPhone: input.contactPhone ?? null,
      status: input.status,
      description: input.description ?? '',
      productCategory: { connect: { name: input.type } },
      objective: input.objective ?? '',
      topCommodity: input.topCommodity ?? '',
      topCountry: input.topCountry ?? '',
    },
    include: eventInclude,
  });

  // Notify the SSD team — never let a notification failure break the create.
  try {
    await notifySsdTeam(prisma, {
      message: `Nuevo evento registrado: ${row.name} (${row.dateStart} – ${row.dateEnd})`,
      type: 'info',
      link: `/events/${row.id}`,
    });
  } catch (err) {
    console.error('[notify] createEvent notification failed:', err);
  }

  return toEventDTO(row);
}

export async function updateEvent(prisma: PrismaClient, id: string, patch: Partial<EventInput>) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Event ${id} not found`);
  // `type` maps to the ProductCategory FK.
  const { type, ...rest } = patch;
  const row = await prisma.event.update({
    where: { id },
    data: {
      ...rest,
      ...(type ? { productCategory: { connect: { name: type } } } : {}),
    },
    include: eventInclude,
  });
  return toEventDTO(row);
}

export async function deleteEvent(prisma: PrismaClient, id: string) {
  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`Event ${id} not found`);
  await prisma.event.delete({ where: { id } }); // entries/meetings/notes cascade
}

/** Form A — register a new supplier from a scouting event. */
export async function addSupplierToEvent(
  prisma: PrismaClient,
  eventId: string,
  input: Omit<CreateSupplierInput, 'entrySource' | 'scoutingInput'> & {
    b2bMeeting?: boolean;
    status?: 'Accepted' | 'Rejected' | 'Cancelled';
    result?: 'Included' | 'Not Included';
  },
  actor: AuthUser,
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError(`Event ${eventId} not found`);

  const supplier = await createSupplier(
    prisma,
    { ...input, entrySource: 'Scouting Event', scoutingInput: event.name },
    actor,
  );

  await prisma.eventSupplierEntry.create({
    data: {
      eventId,
      supplierId: supplier.id as string,
      b2bMeeting: input.b2bMeeting ?? false,
      status: input.status ?? 'Accepted',
      result: input.result ?? 'Included',
    },
  });

  return supplier;
}

/** Link an EXISTING supplier to an event (junction upsert). */
export async function linkSupplierToEvent(
  prisma: PrismaClient,
  eventId: string,
  supplierId: string,
  entry: { b2bMeeting?: boolean; status?: string; result?: string },
) {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) throw new NotFoundError(`Event ${eventId} not found`);
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) throw new NotFoundError(`Supplier ${supplierId} not found`);

  await prisma.eventSupplierEntry.upsert({
    where: { eventId_supplierId: { eventId, supplierId } },
    create: {
      eventId,
      supplierId,
      b2bMeeting: entry.b2bMeeting ?? false,
      status: entry.status ?? 'Accepted',
      result: entry.result ?? 'Included',
    },
    update: {
      ...(entry.b2bMeeting !== undefined ? { b2bMeeting: entry.b2bMeeting } : {}),
      ...(entry.status !== undefined ? { status: entry.status } : {}),
      ...(entry.result !== undefined ? { result: entry.result } : {}),
    },
  });
  return getEventById(prisma, eventId);
}
