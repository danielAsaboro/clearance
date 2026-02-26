const TIKTOK_URL_REGEX =
  /^https?:\/\/(www\.)?(tiktok\.com\/@[\w.-]+\/video\/\d+|vm\.tiktok\.com\/[\w]+)/;

export function validateTikTokUrl(url: string): boolean {
  return TIKTOK_URL_REGEX.test(url);
}

export interface TikTokOEmbed {
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  thumbnail_width: number;
  thumbnail_height: number;
  html: string;
  provider_name: string;
}

export async function fetchTikTokOEmbed(
  url: string
): Promise<TikTokOEmbed | null> {
  try {
    const oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
    const res = await fetch(oembedUrl, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Verify a TikTok video contains the required campaign hashtag.
 * Uses oEmbed title field which typically includes caption text and hashtags.
 *
 * @returns Object with verified status and the detected hashtags
 */
export async function verifyTikTokHashtag(
  url: string,
  requiredHashtag: string = "#theclearanceNG"
): Promise<{ verified: boolean; title: string | null; foundHashtags: string[] }> {
  const oembed = await fetchTikTokOEmbed(url);
  if (!oembed) {
    return { verified: false, title: null, foundHashtags: [] };
  }

  const title = oembed.title || "";
  // Extract all hashtags from the title
  const hashtagRegex = /#\w+/g;
  const foundHashtags = title.match(hashtagRegex) || [];

  // Case-insensitive check for the required hashtag
  const verified = foundHashtags.some(
    (tag) => tag.toLowerCase() === requiredHashtag.toLowerCase()
  );

  return { verified, title, foundHashtags };
}
