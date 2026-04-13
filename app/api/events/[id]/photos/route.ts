import { NextRequest, NextResponse } from "next/server";
import {
  addPhoto,
  countPhotosForGuest,
  getEventById,
  listPhotos,
} from "@/lib/store";
import { uploadBase64ToS3 } from "@/lib/s3";

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
      { error: "Photo limit reached for this guest" },
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
