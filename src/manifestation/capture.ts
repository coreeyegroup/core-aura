export type Capture = {
  stop: () => void;
  cancel: () => void;
  result: Promise<Blob>;
};
export async function captureVoice(signal: AbortSignal): Promise<Capture> {
  if (
    !navigator.mediaDevices?.getUserMedia ||
    typeof MediaRecorder === "undefined"
  )
    throw Error(
      "Microphone recording is unavailable in this browser. Use a supported HTTPS browser.",
    );
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
    video: false,
  });
  const close = () => stream.getTracks().forEach((t) => t.stop());
  if (signal.aborted) {
    close();
    throw new DOMException("Recording cancelled", "AbortError");
  }
  const mime = [
    "audio/webm;codecs=opus",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ].find((type) => MediaRecorder.isTypeSupported(type));
  let recorder: MediaRecorder;
  try {
    recorder = new MediaRecorder(stream, {
      ...(mime ? { mimeType: mime } : {}),
      audioBitsPerSecond: 64000,
    });
  } catch (e) {
    close();
    throw e;
  }
  let cancelled = false,
    bytes = 0;
  const chunks: BlobPart[] = [];
  let resolve!: (b: Blob) => void, reject!: (e: Error) => void;
  const result = new Promise<Blob>((a, b) => {
    resolve = a;
    reject = b;
  });
  let limit: ReturnType<typeof setTimeout>;
  const stop = () => {
    if (recorder.state !== "inactive") recorder.stop();
    close();
  };
  const cancel = () => {
    cancelled = true;
    stop();
  };
  recorder.ondataavailable = (e) => {
    if (cancelled) return;
    bytes += e.data.size;
    if (bytes > 5 * 1024 * 1024) {
      cancelled = true;
      stop();
      return;
    }
    chunks.push(e.data);
  };
  recorder.onerror = () => {
    cancelled = true;
    stop();
  };
  recorder.onstop = () => {
    clearTimeout(limit);
    signal.removeEventListener("abort", cancel);
    close();
    if (cancelled) reject(Error("Recording cancelled or exceeded its limit."));
    else
      resolve(
        new Blob(chunks, { type: recorder.mimeType || mime || "audio/webm" }),
      );
  };
  signal.addEventListener("abort", cancel, { once: true });
  try {
    recorder.start(200);
    limit = setTimeout(stop, 60000);
  } catch (e) {
    signal.removeEventListener("abort", cancel);
    close();
    throw e;
  }
  return { stop, cancel, result };
}
