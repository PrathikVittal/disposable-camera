import { NextRequest, NextResponse } from "next/server";
import sharp from "sharp";
import {
  addPhoto,
  countPhotosForGuest,
  getEventById,
  listPhotos,
} from "@/lib/store";
import { cdnUrlForKey, getObjectBuffer, uploadBufferToS3 } from "@/lib/s3";
import { getEventWindow } from "@/lib/eventWindow";

export const runtime = "nodejs";

// Display/thumbnail derivative sizing. Originals are kept untouched.
const DISPLAY_MAX = 2048;
const DISPLAY_QUALITY = 85;
const THUMB_MAX = 400;
const THUMB_QUALITY = 70;

const ORIGINAL_PREFIX = "photos/originals/";

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
  const { key, guestSessionId } = body ?? {};

  if (!key || !guestSessionId) {
    return NextResponse.json(
      { error: "Missing key or guestSessionId" },
      { status: 400 },
    );
  }

  // Only accept keys our own presign endpoint could have issued.
  if (typeof key !== "string" || !key.startsWith(ORIGINAL_PREFIX)) {
    return NextResponse.json({ error: "Invalid key" }, { status: 400 });
  }

  const alreadyTaken = await countPhotosForGuest(event.id, guestSessionId);
  if (alreadyTaken >= event.photoLimitPerGuest) {
    return NextResponse.json(
      { error: "Photo limit reached for this guest", reason: "limit_reached" },
      { status: 403 },
    );
  }

  // The uuid is shared across the three derivatives for traceability.
  const uuid = key.slice(ORIGINAL_PREFIX.length).replace(/\.jpg$/i, "");

  // Read the uploaded original and derive a web display + thumbnail version.
  let storageUrl: string;
  let thumbnailUrl: string;
  try {
    const original = await getObjectBuffer(key);

    // .rotate() with no args auto-orients from EXIF before stripping metadata,
    // so derivatives are never sideways.
    const [displayBuf, thumbBuf] = await Promise.all([
      sharp(original)
        .rotate()
        .resize(DISPLAY_MAX, DISPLAY_MAX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: DISPLAY_QUALITY })
        .toBuffer(),
      sharp(original)
        .rotate()
        .resize(THUMB_MAX, THUMB_MAX, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer(),
    ]);

    [storageUrl, thumbnailUrl] = await Promise.all([
      uploadBufferToS3(displayBuf, `photos/display/${uuid}.jpg`, "image/jpeg"),
      uploadBufferToS3(thumbBuf, `photos/thumb/${uuid}.jpg`, "image/jpeg"),
    ]);
  } catch (err) {
    console.error("[photos POST] derivative generation failed:", err);
    return NextResponse.json(
      { error: "Failed to process photo. Please try again." },
      { status: 500 },
    );
  }

  const status: "pending" | "approved" =
    event.moderationEnabled === true ? "pending" : "approved";

  const photo = await addPhoto({
    eventId: event.id,
    guestSessionId,
    storageUrl, // display version
    originalUrl: cdnUrlForKey(key),
    thumbnailUrl,
    status,
  });

  return NextResponse.json({ photo }, { status: 201 });
}
