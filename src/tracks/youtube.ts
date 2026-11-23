export const youtubeLinksKey = "core-aura.youtube-links.v1";
export const youtubeLinkLimit = 200;
const videoId = /^[A-Za-z0-9_-]{11}$/;
const localAudioId = /^track:[a-f0-9]{64}$/;

export type YouTubeLink = { id: string; title: string; trackId?: string };

export function youtubeVideoId(value: string) {
  let url: URL;
  try { url = new URL(value.trim()); }
  catch { throw Error("Paste a complete YouTube video link."); }
  const supported = ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com"];
  let id: string | null | undefined;
  if (url.protocol === "https:" && !url.username && !url.password && !url.port) {
    if (url.hostname === "youtu.be") id = /^\/([^/]+)\/?$/.exec(url.pathname)?.[1];
    else if (supported.includes(url.hostname))
      id = url.pathname === "/watch" ? url.searchParams.get("v") :
        /^\/(?:shorts|live|embed)\/([^/]+)\/?$/.exec(url.pathname)?.[1];
  }
  if (!id || !videoId.test(id)) throw Error("Use a YouTube link to an individual video or song.");
  return id;
}

export function parseYouTubeLinks(value: unknown): YouTubeLink[] {
  if (!Array.isArray(value) || value.length > youtubeLinkLimit) throw Error("Invalid YouTube link list.");
  const ids = new Set<string>();
  return value.map(row => {
    if (!row || typeof row.id !== "string" || !videoId.test(row.id) || ids.has(row.id) ||
        typeof row.title !== "string" || !row.title.trim() || row.title.length > 80 ||
        (row.trackId !== undefined && (typeof row.trackId !== "string" || !localAudioId.test(row.trackId))))
      throw Error("Invalid saved YouTube link.");
    ids.add(row.id);
    return { id: row.id, title: row.title.trim(), ...(row.trackId ? { trackId: row.trackId } : {}) };
  });
}
