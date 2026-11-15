import { ENGINE_VERSION } from "../model";
export type PackAsset = {
  id: string;
  title: string;
  url: string;
  sha256: string;
  bytes: number;
  seconds: number;
};
export type SoundPack = {
  id: string;
  title: string;
  description: string;
  tradition: string;
  creator: string;
  license: string;
  attribution: string;
  provenance: string;
  version: string;
  minimum_engine: string;
  assets: PackAsset[];
};
export const MAX_PACK_BYTES = 25 * 1024 * 1024;
export function compareVersion(a: string, b: string) {
  const av = a.split(".").map(Number),
    bv = b.split(".").map(Number);
  for (let i = 0; i < Math.max(av.length, bv.length); i++) {
    const d = (av[i] || 0) - (bv[i] || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}
export function compatible(pack: SoundPack) {
  return compareVersion(pack.minimum_engine, ENGINE_VERSION) <= 0;
}
export function parsePack(value: unknown): SoundPack {
  const p = value as SoundPack;
  const text = (v: unknown, max: number) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max;
  if (
    !p ||
    !/^[a-z0-9][a-z0-9-]{0,79}$/.test(p.id) ||
    !/^\d+\.\d+\.\d+$/.test(p.version) ||
    !/^\d+\.\d+$/.test(p.minimum_engine) ||
    !text(p.title, 120) ||
    !text(p.description, 2000) ||
    !text(p.creator, 200) ||
    !text(p.license, 300) ||
    !text(p.attribution, 1000) ||
    !text(p.provenance, 1000) ||
    !text(p.tradition, 120) ||
    !Array.isArray(p.assets) ||
    p.assets.length < 1 ||
    p.assets.length > 20
  )
    throw Error("Unsupported sound pack");
  for (const a of p.assets) {
    if (
      !a ||
      !/^[a-z0-9][a-z0-9-]{0,79}$/.test(a.id) ||
      !text(a.title, 120) ||
      !/^\/packs\/[a-zA-Z0-9/_.-]+\/[a-zA-Z0-9_.-]+\.wav$/.test(a.url) ||
      a.url.includes("..") ||
      !/^[a-f0-9]{64}$/.test(a.sha256) ||
      !Number.isInteger(a.bytes) ||
      a.bytes < 46 ||
      a.bytes > MAX_PACK_BYTES ||
      !Number.isFinite(a.seconds) ||
      a.seconds <= 0 ||
      a.seconds > 600
    )
      throw Error("Unsupported sound pack file");
  }
  if (
    new Set(p.assets.map((a) => a.id)).size !== p.assets.length ||
    p.assets.reduce((n, a) => n + a.bytes, 0) > MAX_PACK_BYTES
  )
    throw Error("Unsupported sound pack size");
  return p;
}
export function parseCatalog(value: unknown): SoundPack[] {
  const rows = (value as { packs?: unknown[] })?.packs;
  if (!Array.isArray(rows) || rows.length > 200)
    throw Error("Unsupported catalog");
  return rows
    .filter((p: any) => Array.isArray(p?.assets) && p.assets.length)
    .map(parsePack);
}
export function validateWav(buffer: ArrayBuffer, asset: PackAsset) {
  const v = new DataView(buffer),
    text = (at: number, size: number) =>
      String.fromCharCode(...new Uint8Array(buffer, at, size));
  if (
    buffer.byteLength < 46 ||
    text(0, 4) !== "RIFF" ||
    text(8, 4) !== "WAVE" ||
    text(12, 4) !== "fmt " ||
    v.getUint32(16, true) !== 16 ||
    v.getUint16(20, true) !== 1 ||
    ![1, 2].includes(v.getUint16(22, true)) ||
    ![44100, 48000].includes(v.getUint32(24, true)) ||
    v.getUint16(34, true) !== 16 ||
    text(36, 4) !== "data" ||
    v.getUint32(40, true) !== buffer.byteLength - 44 ||
    v.getUint32(4, true) !== buffer.byteLength - 8 ||
    v.getUint16(32, true) !== v.getUint16(22, true) * 2 ||
    v.getUint32(28, true) !== v.getUint32(24, true) * v.getUint16(32, true) ||
    Math.abs((buffer.byteLength - 44) / v.getUint32(28, true) - asset.seconds) >
      0.01
  )
    throw Error("The audio format or duration is invalid");
}
export function packBytes(pack: SoundPack) {
  return pack.assets.reduce((n, a) => n + a.bytes, 0);
}
export function megabytes(bytes: number) {
  return (bytes / 1024 / 1024).toFixed(1) + " MB";
}
