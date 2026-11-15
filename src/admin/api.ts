import { SoundPack, PackAsset } from "../packs/catalog";
export type ManagedPack = SoundPack & {
  revision: number;
  status: "draft" | "reviewed" | "published" | "withdrawn";
};
export type PackEvent = {
  id: string;
  revision: number;
  action: string;
  actor: string;
  created_at: string;
  details: Record<string, unknown>;
};
export class AdminApi {
  constructor(
    private key: string,
    private operator: string,
  ) {}
  async request<T>(path: string, method = "GET", body?: unknown): Promise<T> {
    const response = await fetch("/api/admin/" + path, {
      method,
      headers: {
        Authorization: "Bearer " + this.key,
        "X-Core-Aura-Operator": encodeURIComponent(this.operator),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) {
      if (response.status === 401)
        throw Error("Access key was not accepted. Sign out and connect again.");
      let detail;
      try {
        detail = (await response.json()).detail;
      } catch {}
      if (typeof detail === "string") throw Error(detail);
      if (Array.isArray(detail))
        throw Error(
          "Check " +
            detail.map((d) => d.loc?.slice(1).join(" ")).join(", ") +
            ".",
        );
      throw Error(
        "The content service is unavailable. Check the backend installation.",
      );
    }
    return response.json();
  }
  upload(
    file: File,
    id: string,
    title: string,
    signal: AbortSignal,
    progress: (value: number) => void,
  ): Promise<PackAsset> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(
        "POST",
        "/api/admin/assets/" +
          encodeURIComponent(id) +
          "?title=" +
          encodeURIComponent(title),
      );
      xhr.setRequestHeader("Authorization", "Bearer " + this.key);
      xhr.setRequestHeader(
        "X-Core-Aura-Operator",
        encodeURIComponent(this.operator),
      );
      xhr.setRequestHeader("Content-Type", "audio/wav");
      const abort = () => xhr.abort();
      signal.addEventListener("abort", abort, { once: true });
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable)
          progress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        signal.removeEventListener("abort", abort);
        try {
          const data = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) resolve(data);
          else
            reject(
              Error(
                typeof data.detail === "string"
                  ? data.detail
                  : "Upload failed. Check the WAV format and access key.",
              ),
            );
        } catch {
          reject(Error("Upload failed. Check the content service."));
        }
      };
      xhr.onerror = () => {
        signal.removeEventListener("abort", abort);
        reject(Error("Upload failed. Check your connection."));
      };
      xhr.onabort = () => {
        signal.removeEventListener("abort", abort);
        reject(Error("Upload cancelled. The draft was not changed."));
      };
      if (signal.aborted) {
        reject(Error("Upload cancelled."));
        return;
      }
      xhr.send(file);
    });
  }
  async audio(sha: string) {
    const response = await fetch("/api/admin/assets/" + sha, {
      headers: { Authorization: "Bearer " + this.key },
      cache: "no-store",
    });
    if (!response.ok) throw Error("Preview unavailable");
    return response.arrayBuffer();
  }
}
