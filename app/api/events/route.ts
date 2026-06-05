import { NextRequest, NextResponse } from "next/server";
import { createEvent, listEvents } from "@/lib/store";
import { auth } from "@/lib/auth";
import { uploadBase64ToS3 } from "@/lib/s3";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const events = await listEvents(session.user.id);
  return NextResponse.json({ events });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();

  const {
    name,
    date,
    description,
    photoLimitPerGuest,
    startTime,
    endTime,
    timezone,
    moderationEnabled,
  } = body ?? {};

  // coverImageUrl may be a base64 dataUrl (client-side upload) or an existing CDN URL
  let coverImageUrl: string | undefined = body.coverImageUrl || undefined;

  if (!name || !date || !photoLimitPerGuest) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  const limit = Number(photoLimitPerGuest);
  if (!Number.isFinite(limit) || limit < 1 || limit > 50) {
    return NextResponse.json(
      { error: "photoLimitPerGuest must be between 1 and 50" },
      { status: 400 },
    );
  }

  // If the cover image is a base64 dataUrl, upload to S3
  if (coverImageUrl?.startsWith("data:")) {
    try {
      coverImageUrl = await uploadBase64ToS3(coverImageUrl, "covers");
    } catch (err) {
      console.error("[events POST] cover image upload failed:", err);
      // Don't fail the entire event creation if cover upload fails
      coverImageUrl = undefined;
    }
  }

  const event = await createEvent({
    hostId: session.user.id,
    name,
    date,
    description,
    coverImageUrl,
    photoLimitPerGuest: limit,
    startTime,
    endTime,
    timezone,
    moderationEnabled: Boolean(moderationEnabled),
  });

  return NextResponse.json({ event }, { status: 201 });
}
