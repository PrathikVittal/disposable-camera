-- AlterTable
ALTER TABLE "Photo" ADD COLUMN     "originalUrl" TEXT,
ADD COLUMN     "thumbnailUrl" TEXT;

-- Backfill: pre-existing photos only ever had a single version. Mirror it into
-- the new columns so the original-download and thumbnail-grid paths still work.
UPDATE "Photo" SET "originalUrl" = "storageUrl", "thumbnailUrl" = "storageUrl"
WHERE "originalUrl" IS NULL;
