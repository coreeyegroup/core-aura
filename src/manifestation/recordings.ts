export type PersonalRecording = {
  id: string;
  text: string;
  title?: string;
  mime: string;
  seconds: number;
  createdAt: string;
  blob: Blob;
};
const changed = () => dispatchEvent(new Event("core-aura-recordings-changed"));
function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("core-aura-personal-voice", 1);
    r.onupgradeneeded = () =>
      r.result.createObjectStore("recordings", { keyPath: "id" });
    r.onsuccess = () => resolve(r.result);
    r.onerror = () =>
      reject(Error("Personal recording storage is unavailable."));
    r.onblocked = () =>
      reject(Error("Close other Core-aura windows and try again."));
  });
}
export async function recordings(): Promise<PersonalRecording[]> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", "readonly"),
      r = tx.objectStore("recordings").getAll();
    tx.oncomplete = () => {
      db.close();
      resolve(r.result);
    };
    tx.onerror = () => {
      db.close();
      reject(Error("Recordings could not be read."));
    };
  });
}
export async function recording(id: string): Promise<PersonalRecording> {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("recordings", "readonly"),
      r = tx.objectStore("recordings").get(id);
    tx.oncomplete = () => {
      db.close();
      if (r.result) resolve(r.result);
      else
        reject(
          Error(
            "This personal recording is unavailable. Record it again or use the device voice.",
          ),
        );
    };
    tx.onerror = () => {
      db.close();
      reject(Error("The personal recording could not be read."));
    };
  });
}
export async function saveRecording(value: PersonalRecording) {
  if (
    value.blob.size > 5 * 1024 * 1024 ||
    value.blob.size < 128 ||
    value.seconds <= 0 ||
    value.seconds > 65
  )
    throw Error("Record up to 60 seconds, under 5 MB.");
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite"),
      store = tx.objectStore("recordings"),
      r = store.getAll();
    let message = "Recording could not be saved. Check device storage.";
    r.onsuccess = () => {
      const previous = r.result.filter(
        (p: PersonalRecording) => p.id !== value.id,
      );
      if (
        previous.length >= 100 ||
        previous.reduce(
          (n: number, p: PersonalRecording) => n + p.blob.size,
          0,
        ) +
          value.blob.size >
          50 * 1024 * 1024
      ) {
        message =
          "Personal recordings are limited to 100 clips and 50 MB. Remove an unused clip first.";
        tx.abort();
        return;
      }
      store.put(value);
    };
    tx.oncomplete = () => {
      db.close();
      changed();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(Error(message));
    };
  });
}
export async function renameRecording(id: string, title: string) {
  const name = title.trim();
  if (!name || name.length > 80) throw Error("Use a recording name of 1–80 characters.");
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    const store = tx.objectStore("recordings");
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, title: name });
      else tx.abort();
    };
    tx.oncomplete = () => { db.close(); changed(); resolve(); };
    tx.onerror = tx.onabort = () => { db.close(); reject(Error("Recording could not be renamed.")); };
  });
}
export async function deleteRecording(id: string) {
  const db = await open();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("recordings", "readwrite");
    tx.objectStore("recordings").delete(id);
    tx.oncomplete = () => {
      db.close();
      changed();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(Error("Recording removal failed. The file was kept."));
    };
  });
}
export function withoutRecordings<
  T extends { lines: any[]; useRecordings?: boolean },
>(plan: T): T {
  return {
    ...plan,
    useRecordings: false,
    lines: plan.lines.map(({ recordingId, recordedText, ...line }) => line),
  };
}
