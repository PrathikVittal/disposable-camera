import type { Event, Photo, PhotoStatus } from "@/lib/types";
import prisma from "@/lib/db";
import { deleteFromS3 } from "@/lib/s3";

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export async function createEvent(input: {
  hostId: string;
  name: string;
  date: string;
  description?: string;
  coverImageUrl?: string;
  photoLimitPerGuest: number;
  startTime?: string;
  endTime?: string;
  moderationEnabled: boolean;
}): Promise<Event> {
  const event = await prisma.event.create({
    data: {
      slug: crypto.randomUUID(),
      hostId: input.hostId,
      name: input.name,
      date: input.date,
      description: input.description ?? null,
      coverImageUrl: input.coverImageUrl ?? null,
      photoLimitPerGuest: input.photoLimitPerGuest,
      startTime: input.startTime ?? null,
      endTime: input.endTime ?? null,
      moderationEnabled: input.moderationEnabled,
    },
  });

  return toEvent(event);
}

export async function listEvents(hostId?: string): Promise<Event[]> {
  const rows = await prisma.event.findMany({
    where: hostId ? { hostId } : undefined,
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toEvent);
}

export async function getEventById(id: string): Promise<Event | undefined> {
  const row = await prisma.event.findUnique({ where: { id } });
  return row ? toEvent(row) : undefined;
}

export async function getEventBySlug(slug: string): Promise<Event | undefined> {
  const row = await prisma.event.findUnique({ where: { slug } });
  return row ? toEvent(row) : undefined;
}

export async function updateEvent(
  id: string,
  partial: Partial<
    Pick<
      Event,
      | "name"
      | "date"
      | "description"
      | "coverImageUrl"
      | "photoLimitPerGuest"
      | "startTime"
      | "endTime"
      | "moderationEnabled"
    >
  >,
): Promise<Event | undefined> {
  try {
    const row = await prisma.event.update({
      where: { id },
      data: {
        ...(partial.name !== undefined && { name: partial.name }),
        ...(partial.date !== undefined && { date: partial.date }),
        ...(partial.description !== undefined && { description: partial.description }),
        ...(partial.coverImageUrl !== undefined && { coverImageUrl: partial.coverImageUrl }),
        ...(partial.photoLimitPerGuest !== undefined && {
          photoLimitPerGuest: partial.photoLimitPerGuest,
        }),
        ...(partial.startTime !== undefined && { startTime: partial.startTime }),
        ...(partial.endTime !== undefined && { endTime: partial.endTime }),
        ...(partial.moderationEnabled !== undefined && {
          moderationEnabled: partial.moderationEnabled,
        }),
      },
    });
    return toEvent(row);
  } catch {
    return undefined;
  }
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

export async function listPhotos(eventId: string, status?: PhotoStatus): Promise<Photo[]> {
  const rows = await prisma.photo.findMany({
    where: {
      eventId,
      ...(status ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toPhoto);
}

export async function countPhotosForGuest(
  eventId: string,
  guestSessionId: string,
): Promise<number> {
  return prisma.photo.count({ where: { eventId, guestSessionId } });
}

export async function addPhoto(input: {
  eventId: string;
  guestSessionId: string;
  storageUrl: string;
  status: PhotoStatus;
}): Promise<Photo> {
  const row = await prisma.photo.create({
    data: {
      eventId: input.eventId,
      guestSessionId: input.guestSessionId,
      storageUrl: input.storageUrl,
      status: input.status,
    },
  });
  return toPhoto(row);
}

export async function updatePhotoStatus(
  eventId: string,
  photoId: string,
  status: PhotoStatus,
): Promise<Photo | undefined> {
  try {
    const row = await prisma.photo.update({
      where: { id: photoId, eventId },
      data: { status },
    });
    return toPhoto(row);
  } catch {
    return undefined;
  }
}

export async function deletePhoto(
  eventId: string,
  photoId: string,
): Promise<boolean> {
  try {
    const photo = await prisma.photo.findUnique({
      where: { id: photoId, eventId },
    });
    if (!photo) return false;

    await prisma.photo.delete({ where: { id: photoId } });

    // Clean up the S3 object — fire and forget (don't fail the request if S3 errors)
    deleteFromS3(photo.storageUrl).catch((err) =>
      console.error("[store] deleteFromS3 failed:", err),
    );

    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Row → type mappers
// ---------------------------------------------------------------------------

function toEvent(row: {
  id: string;
  slug: string;
  hostId: string;
  name: string;
  date: string;
  description: string | null;
  coverImageUrl: string | null;
  photoLimitPerGuest: number;
  startTime: string | null;
  endTime: string | null;
  moderationEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}): Event {
  return {
    id: row.id,
    slug: row.slug,
    hostId: row.hostId,
    name: row.name,
    date: row.date,
    description: row.description ?? undefined,
    coverImageUrl: row.coverImageUrl ?? undefined,
    photoLimitPerGuest: row.photoLimitPerGuest,
    startTime: row.startTime ?? undefined,
    endTime: row.endTime ?? undefined,
    moderationEnabled: row.moderationEnabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toPhoto(row: {
  id: string;
  eventId: string;
  guestSessionId: string;
  storageUrl: string;
  status: string;
  createdAt: Date;
}): Photo {
  return {
    id: row.id,
    eventId: row.eventId,
    guestSessionId: row.guestSessionId,
    storageUrl: row.storageUrl,
    status: row.status as PhotoStatus,
    createdAt: row.createdAt.toISOString(),
  };
}
