import { Capacitor } from "@capacitor/core";
import type { Voice } from "./speech";
const base = () =>
  Capacitor.isNativePlatform() ? "https://core-aura.coreeye.in" : "";
let catalog: Promise<Voice[]> | undefined;
const cache = new Map<string, ArrayBuffer>();
let bytes = 0;
export function coreVoices(refresh = false): Promise<Voice[]> {
  if (refresh) catalog = undefined;
  if (!catalog)
    catalog = fetch(base() + "/api/speech/voices", {
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        const data = await r.json();
        if (!data.ready || !Array.isArray(data.voices)) return [];
        return data.voices.filter(
          (v: Voice) =>
            typeof v.voiceURI === "string" &&
            /^core:[a-z-]+(\+(f2|m3))?$/.test(v.voiceURI) &&
            typeof v.name === "string" &&
            typeof v.lang === "string",
        );
      })
      .catch(() => []);
  return catalog;
}
export async function serverSpeech(
  text: string,
  voice: string,
  rate: number,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  signal.throwIfAborted();
  const key = JSON.stringify([text, voice, rate]);
  const existing = cache.get(key);
  if (existing) {
    cache.delete(key);
    cache.set(key, existing);
    return existing.slice(0);
  }
  const response = await fetch(base() + "/api/speech/speak", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, voice, rate }),
    signal:
      typeof AbortSignal.any === "function"
        ? AbortSignal.any([signal, AbortSignal.timeout(20000)])
        : signal,
    cache: "no-store",
  });
  if (!response.ok) {
    let message =
      "Core-aura speech is unavailable. Check your internet connection and backend.";
    try {
      const data = await response.json();
      if (typeof data.detail === "string") message = data.detail;
    } catch {}
    throw Error(message);
  }
  if (response.headers.get("content-type")?.split(";")[0] !== "audio/wav")
    throw Error("The voice server returned an invalid audio response.");
  const reader = response.body?.getReader();
  if (!reader) throw Error("No speech audio was returned.");
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  try {
    while (true) {
      const next = await reader.read();
      signal.throwIfAborted();
      if (next.done) break;
      length += next.value.byteLength;
      if (length > 6 * 1024 * 1024)
        throw Error("Speech audio is too large. Use a shorter sentence.");
      chunks.push(next.value);
    }
  } catch (e) {
    await reader.cancel().catch(() => {});
    throw e;
  } finally {
    reader.releaseLock();
  }
  if (length < 46) throw Error("Speech audio was empty.");
  const out = new Uint8Array(length);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.byteLength;
  }
  while (cache.size && bytes + length > 10 * 1024 * 1024) {
    const oldest = cache.keys().next().value!;
    bytes -= cache.get(oldest)!.byteLength;
    cache.delete(oldest);
  }
  cache.set(key, out.buffer);
  bytes += length;
  return out.buffer.slice(0);
}
