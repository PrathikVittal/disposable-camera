import { NextRequest, NextResponse } from "next/server";
import { deletePhoto, getEventById, updatePhotoStatus } from "@/lib/store";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const body = await req.json();
  const { status } = body ?? {};

  if (!status || !["pending", "approved", "rejected"].includes(status)) {
    return NextResponse.json(
      { error: "Invalid or missing status" },
      { status: 400 },
    );
  }

  const updated = await updatePhotoStatus(event.id, photoId, status);
  if (!updated) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  return NextResponse.json({ photo: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; photoId: string }> },
) {
  const { id, photoId } = await params;
  const event = await getEventById(id);
  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const deleted = await deletePhoto(id, photoId);
  if (!deleted) {
    return NextResponse.json({ error: "Photo not found" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
