import { validateTikTokUrl } from "@/lib/tiktok";

describe("TikTok Utilities", () => {
  describe("validateTikTokUrl", () => {
    it("accepts standard TikTok video URLs", () => {
      expect(validateTikTokUrl("https://www.tiktok.com/@user/video/1234567890")).toBe(true);
      expect(validateTikTokUrl("https://tiktok.com/@user_name/video/1234567890")).toBe(true);
      expect(validateTikTokUrl("http://www.tiktok.com/@user.name/video/9876543210")).toBe(true);
    });

    it("accepts shortened vm.tiktok.com URLs", () => {
      expect(validateTikTokUrl("https://vm.tiktok.com/ZM6abc123")).toBe(true);
      expect(validateTikTokUrl("http://vm.tiktok.com/abc")).toBe(true);
    });

    it("rejects non-TikTok URLs", () => {
      expect(validateTikTokUrl("https://youtube.com/watch?v=abc")).toBe(false);
      expect(validateTikTokUrl("https://instagram.com/p/abc")).toBe(false);
      expect(validateTikTokUrl("https://twitter.com/user/status/123")).toBe(false);
    });

    it("rejects invalid URLs", () => {
      expect(validateTikTokUrl("not a url")).toBe(false);
      expect(validateTikTokUrl("")).toBe(false);
      expect(validateTikTokUrl("tiktok.com/@user/video/123")).toBe(false);
    });

    it("rejects TikTok URLs without video path", () => {
      expect(validateTikTokUrl("https://www.tiktok.com/@user")).toBe(false);
      expect(validateTikTokUrl("https://www.tiktok.com")).toBe(false);
    });
  });
});
