import { NextRequest, NextResponse } from "next/server";
import { getEventById, listPhotos, updateEvent } from "@/lib/store";
import { auth } from "@/lib/auth";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Guest camera pages don't need auth — event data is public (accessed via QR).
  const photos = await listPhotos(id);
  return NextResponse.json({ event, photos });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const existing = await getEventById(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  if (existing.hostId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();

  const updated = await updateEvent(id, {
    name: body.name,
    date: body.date,
    description: body.description,
    coverImageUrl: body.coverImageUrl,
    photoLimitPerGuest:
      typeof body.photoLimitPerGuest === "number"
        ? body.photoLimitPerGuest
        : undefined,
    startTime: body.startTime,
    endTime: body.endTime,
    timezone: typeof body.timezone === "string" ? body.timezone : undefined,
    moderationEnabled:
      typeof body.moderationEnabled === "boolean"
        ? body.moderationEnabled
        : undefined,
  });

  return NextResponse.json({ event: updated });
}
