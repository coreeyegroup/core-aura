import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
const folder = "core-aura-exports",
  maxBytes = 60 * 1024 * 1024;
let sharing = false;
export const fileSharing = () => sharing;
export async function cleanupExports() {
  if (!Capacitor.isNativePlatform() || sharing) return;
  try {
    const { files } = await Filesystem.readdir({
      path: folder,
      directory: Directory.Cache,
    });
    for (const f of files) {
      if (
        f.type === "file" &&
        /^\d{13}-[a-zA-Z0-9_.-]+\.(wav|json|ics|mp3|m4a|aac|ogg|flac|zip)$/.test(f.name) &&
        typeof f.mtime === "number" &&
        f.mtime < Date.now() - 86400000
      )
        await Filesystem.deleteFile({
          path: folder + "/" + f.name,
          directory: Directory.Cache,
        });
    }
  } catch {
    /* A missing cache directory is expected on first launch. */
  }
}
function base64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => {
      const data = String(r.result);
      resolve(data.slice(data.indexOf(",") + 1));
    };
    r.onerror = () => reject(Error("The export file could not be prepared."));
    r.readAsDataURL(blob);
  });
}
export async function deliverFile(blob: Blob, name: string): Promise<string> {
  if (!blob.size || blob.size > maxBytes)
    throw Error("Choose an export between 1 byte and 60 MB.");
  const safe = name
    .replace(/[^a-zA-Z0-9_.-]/g, "-")
    .replace(/^\.+/, "")
    .slice(0, 100);
  if (!safe || !/^.+\.(wav|json|ics|mp3|m4a|aac|ogg|flac|zip)$/.test(safe))
    throw Error("Unsupported export filename.");
  if (!Capacitor.isNativePlatform()) {
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = safe;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
    return "File prepared. Check your downloads.";
  }
  if (sharing) throw Error("Finish the current share action first.");
  sharing = true;
  try {
    if (!(await Share.canShare()).value)
      throw Error("File sharing is unavailable on this device.");
    const path = `${folder}/${Date.now()}-${crypto.randomUUID()}-${safe}`;
    const { uri } = await Filesystem.writeFile({
      path,
      directory: Directory.Cache,
      data: await base64(blob),
      recursive: true,
    });
    // Keep the file available for receivers that read asynchronously after choosing a destination.
    try {
      await Share.share({
        title: "Core-aura export",
        files: [uri],
        dialogTitle: "Save or share file",
      });
    } catch (e) {
      if (/cancel|dismiss/i.test((e as Error)?.message || ""))
        return "Share cancelled. Your original remains in Core-aura.";
      throw e;
    }
    return "Share sheet closed. Check your chosen app or folder.";
  } finally {
    sharing = false;
  }
}
