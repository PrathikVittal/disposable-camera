import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { countPhotosForGuest, getEventById } from "@/lib/store";
import { getPresignedPutUrl } from "@/lib/s3";
import { getEventWindow } from "@/lib/eventWindow";

export const runtime = "nodejs";

/**
 * Issues a short-lived presigned URL the browser uses to upload a full-
 * resolution photo original straight to S3. Re-checks the time window and the
 * per-guest limit first so we don't hand out an upload slot the guest can't use
 * (the finalize step re-validates both authoritatively).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

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
  const { guestSessionId } = body ?? {};
  if (!guestSessionId) {
    return NextResponse.json(
      { error: "Missing guestSessionId" },
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

  const key = `photos/originals/${randomUUID()}.jpg`;
  const uploadUrl = await getPresignedPutUrl(key, "image/jpeg");

  return NextResponse.json({ uploadUrl, key });
}
