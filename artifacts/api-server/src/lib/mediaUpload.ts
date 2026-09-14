export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024;

export interface ExpectedUploadMetadata {
  size: number;
  contentType: string;
  mediaType: "image" | "video";
}

export interface ObjectMetadata {
  size?: string | number;
  contentType?: string | null;
}

/**
 * GCS reports object size as a string. Keep completion strict: a successful
 * direct upload must have exactly the bytes and MIME type that were declared
 * when its pending attachment was created.
 */
export function uploadedMetadataMatches(
  expected: ExpectedUploadMetadata,
  actual: ObjectMetadata,
) {
  const size = typeof actual.size === "number" ? actual.size : Number(actual.size);
  const maxSize = expected.mediaType === "video" ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
  return Number.isSafeInteger(size)
    && size > 0
    && size <= maxSize
    && size === expected.size
    && actual.contentType === expected.contentType;
}