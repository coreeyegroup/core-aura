import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { renderWav } from "../public/render-wav.js";
const assets = [];
for (const [sound, hz, title] of [
  ["bell", 432, "Bell · 432 Hz"],
  ["bowl", 432, "Singing bowl · 432 Hz"],
  ["flute", 432, "Flute study · 432 Hz"],
]) {
  const iterator = renderWav(
    [{ id: sound, sound, hz, seconds: 15, volume: 1, muted: false }],
    1,
    15,
  );
  let next = iterator.next();
  while (!next.done) next = iterator.next();
  const bytes = Buffer.from(next.value),
    sha256 = createHash("sha256").update(bytes).digest("hex");
  const url = `/packs/core-resonance/1.0.0/${sound}-${sha256.slice(0, 12)}.wav`;
  await mkdir("dist" + url.slice(0, url.lastIndexOf("/")), { recursive: true });
  await writeFile("dist" + url, bytes);
  assets.push({
    id: sound,
    title,
    url,
    sha256,
    bytes: bytes.length,
    seconds: 15,
  });
}
const manifest = {
  id: "core-resonance",
  title: "Core Resonance",
  description:
    "Three original 15-second sound studies. Fixed tuning, generated from the Core-aura synthesis engine; no performer recordings.",
  tradition: "Original synthesis",
  creator: "Core-aura",
  license: "CC0-1.0",
  attribution: "Core-aura synthesis engine",
  provenance:
    "Generated reproducibly by scripts/build-packs.mjs from public/dsp.js. No traditional interpretation or performer recording is claimed.",
  version: "1.0.0",
  minimum_engine: "2.0",
  assets,
};
await writeFile(
  "dist/catalog-packs.json",
  JSON.stringify({ packs: [manifest] }, null, 2) + "\n",
);
console.log(
  "Prepared optional sound pack:",
  assets.reduce((n, a) => n + a.bytes, 0),
  "bytes",
);
