import { NextRequest, NextResponse } from "next/server";
import {
  addPhoto,
  countPhotosForGuest,
  getEventById,
  listPhotos,
} from "@/lib/store";
import { uploadBase64ToS3 } from "@/lib/s3";
import { getEventWindow } from "@/lib/eventWindow";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const { searchParams } = new URL(req.url);

  // Per-guest count — used by the guest page to rehydrate "shots remaining"
  // after a refresh. Authoritative source of truth.
  const guestSessionId = searchParams.get("guestSessionId");
  if (guestSessionId) {
    const count = await countPhotosForGuest(id, guestSessionId);
    return NextResponse.json({ count });
  }

  const status = searchParams.get("status") as
    | "pending"
    | "approved"
    | "rejected"
    | null;

  const photos = await listPhotos(id, status ?? undefined);
  return NextResponse.json({ photos });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Enforce the event time window — uploads are only accepted while the event
  // is open (server clock is authoritative; can't be bypassed client-side).
  const window = getEventWindow(event);
  if (window.state === "before") {
    return NextResponse.json(
      { error: "This event hasn't started yet.", reason: "event_not_started" },
      { status: 403 },
    );
  }
  if (window.state === "ended") {
    return NextResponse.json(
      { error: "This event has ended.", reason: "event_ended" },
      { status: 403 },
    );
  }

  const body = await req.json();
  const { dataUrl, guestSessionId } = body ?? {};

  if (!dataUrl || !guestSessionId) {
    return NextResponse.json(
      { error: "Missing dataUrl or guestSessionId" },
      { status: 400 },
    );
  }

  const alreadyTaken = await countPhotosForGuest(event.id, guestSessionId);
  if (alreadyTaken >= event.photoLimitPerGuest) {
    return NextResponse.json(
      { error: "Photo limit reached for this guest", reason: "limit_reached" },
      { status: 403 },
    );
  }

  // Upload to S3 and get CDN URL
  let storageUrl: string;
  try {
    storageUrl = await uploadBase64ToS3(dataUrl, "photos");
  } catch (err) {
    console.error("[photos POST] S3 upload failed:", err);
    return NextResponse.json(
      { error: "Failed to upload photo. Please try again." },
      { status: 500 },
    );
  }

  const status: "pending" | "approved" =
    event.moderationEnabled === true ? "pending" : "approved";

  const photo = await addPhoto({
    eventId: event.id,
    guestSessionId,
    storageUrl,
    status,
  });

  return NextResponse.json({ photo }, { status: 201 });
}
