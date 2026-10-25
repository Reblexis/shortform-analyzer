// TikTok posts through apinoa (`tiktok/media`, 2 units, about 3 s). Loaded only when a URL is passed.
import type { InputOptions } from "../types.js";

/** The post's video bytes. */
export async function fetchTikTok(post: string, options: InputOptions & { apiKey: string }): Promise<Buffer> {
  const { ApinoaClient } = await import("@apinoa/sdk");
  const client = new ApinoaClient({ apiKey: options.apiKey, ...(options.fetch ? { fetch: options.fetch } : {}) });
  const res = await client.tiktok.media({ post });
  const file = res.data;
  if (!file?.data) throw new Error("apinoa returned no file for this post");
  if (file.contentType && !file.contentType.startsWith("video/")) throw new Error(`the post is not a video (${file.contentType})`);
  return Buffer.from(file.data, "base64");
}
