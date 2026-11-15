import {
  compatible,
  compareVersion,
  parsePack,
  SoundPack,
  validateWav,
} from "./catalog";
export type InstalledPack = {
  id: string;
  manifest: SoundPack;
  installedAt: string;
  files: { id: string; blob: Blob }[];
};
const changed = () => dispatchEvent(new Event("core-aura-packs-changed"));
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("core-aura-packs", 1);
    req.onupgradeneeded = () =>
      req.result.createObjectStore("packs", { keyPath: "id" });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(Error("Offline storage is unavailable"));
    req.onblocked = () =>
      reject(Error("Close other Core-aura windows and try again"));
  });
}
export async function installedPacks(): Promise<InstalledPack[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("packs", "readonly"),
      req = tx.objectStore("packs").getAll();
    tx.oncomplete = () => {
      db.close();
      resolve(req.result);
    };
    tx.onerror = () => {
      db.close();
      reject(Error("Downloaded packs could not be read"));
    };
  });
}
export async function removePack(id: string) {
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("packs", "readwrite");
    tx.objectStore("packs").delete(id);
    tx.oncomplete = () => {
      db.close();
      changed();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(Error("The pack could not be removed"));
    };
  });
}
export async function installPack(
  value: SoundPack,
  origin: string,
  signal: AbortSignal,
  progress: (loaded: number, total: number) => void,
) {
  const pack = parsePack(value);
  if (!compatible(pack))
    throw Error("Update the app before downloading this pack");
  const total = pack.assets.reduce((n, a) => n + a.bytes, 0),
    files: InstalledPack["files"] = [];
  let loaded = 0;
  for (const asset of pack.assets) {
    signal.throwIfAborted();
    const response = await fetch(new URL(asset.url, origin), {
      signal,
      cache: "no-store",
      redirect: "error",
    });
    if (!response.ok || !response.body)
      throw Error("A pack file is unavailable. Refresh the catalog and retry");
    const reader = response.body.getReader(),
      chunks: Uint8Array<ArrayBuffer>[] = [];
    let received = 0;
    try {
      while (true) {
        const next = await reader.read();
        if (next.done) break;
        received += next.value.byteLength;
        if (received > asset.bytes)
          throw Error("A download exceeded its declared size");
        chunks.push(next.value);
        progress(loaded + received, total);
      }
    } catch (error) {
      await reader.cancel().catch(() => {});
      throw error;
    }
    if (received !== asset.bytes)
      throw Error("Incomplete download. The previous version has been kept");
    const blob = new Blob(chunks, { type: "audio/wav" }),
      buffer = await blob.arrayBuffer();
    const digest = Array.from(
      new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)),
    )
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("");
    if (digest !== asset.sha256)
      throw Error(
        "File integrity check failed. The previous version has been kept",
      );
    validateWav(buffer, asset);
    files.push({ id: asset.id, blob });
    loaded += received;
  }
  signal.throwIfAborted();
  const db = await open();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction("packs", "readwrite"),
      store = tx.objectStore("packs");
    const abort = () => {
      try {
        tx.abort();
      } catch {}
    };
    signal.addEventListener("abort", abort, { once: true });
    const req = store.get(pack.id);
    let reason =
      "Device storage is full or unavailable. The previous pack has been kept";
    req.onsuccess = () => {
      if (
        req.result &&
        compareVersion(req.result.manifest.version, pack.version) > 0
      ) {
        reason = "A newer version is already installed";
        tx.abort();
        return;
      }
      store.put({
        id: pack.id,
        manifest: pack,
        installedAt: new Date().toISOString(),
        files,
      });
    };
    tx.oncomplete = () => {
      signal.removeEventListener("abort", abort);
      db.close();
      changed();
      resolve();
    };
    tx.onabort = tx.onerror = () => {
      signal.removeEventListener("abort", abort);
      db.close();
      reject(
        signal.aborted
          ? new DOMException("Download cancelled", "AbortError")
          : Error(reason),
      );
    };
    if (signal.aborted) abort();
  });
}
