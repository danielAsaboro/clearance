function encodeKeySegment(segment: string) {
  return encodeURIComponent(segment);
}

export function getStorageAssetPath(key: string) {
  const encodedKey = key
    .split("/")
    .filter(Boolean)
    .map(encodeKeySegment)
    .join("/");

  return `/api/storage/${encodedKey}`;
}

export function getStorageAssetUrl(key: string, origin?: string) {
  const path = getStorageAssetPath(key);
  return origin ? new URL(path, origin).toString() : path;
}
