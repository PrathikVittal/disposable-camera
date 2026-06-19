export type Event = {
  id: string;
  slug: string;
  hostId: string;
  name: string;
  date: string;
  description?: string;
  coverImageUrl?: string;
  photoLimitPerGuest: number;
  startTime?: string;
  endTime?: string;
  timezone: string;
  moderationEnabled: boolean;
  createdAt: string;
  updatedAt: string;
};

export type PhotoStatus = "pending" | "approved" | "rejected";

export type Photo = {
  id: string;
  eventId: string;
  guestSessionId: string;
  storageUrl: string; // display version (web-optimized)
  originalUrl?: string; // full-resolution original (host download)
  thumbnailUrl?: string; // small version (gallery grid)
  status: PhotoStatus;
  createdAt: string;
};

