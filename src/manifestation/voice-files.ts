import { PersonalRecording } from "./recordings";
const maxBytes = 5 * 1024 * 1024,
  maxSeconds = 65,
  rate = 32000;
export function validateVoiceWav(buffer: ArrayBuffer): number {
  if (buffer.byteLength < 46 || buffer.byteLength > maxBytes)
    throw Error("Choose a PCM WAV file under 5 MB, up to 60 seconds.");
  const v = new DataView(buffer),
    text = (at: number) =>
      String.fromCharCode(...new Uint8Array(buffer, at, 4));
  if (
    text(0) !== "RIFF" ||
    text(8) !== "WAVE" ||
    v.getUint32(4, true) !== buffer.byteLength - 8
  )
    throw Error(
      "Choose a valid PCM WAV file. Compressed files must be converted to WAV first.",
    );
  let format: { channels: number; rate: number; align: number } | undefined,
    data: number | undefined,
    chunks = 0;
  for (let at = 12; at < buffer.byteLength; ) {
    if (at + 8 > buffer.byteLength || ++chunks > 4096)
      throw Error("The WAV file is malformed.");
    const kind = text(at),
      size = v.getUint32(at + 4, true),
      start = at + 8,
      end = start + size,
      next = end + (size % 2);
    if (end > buffer.byteLength || next > buffer.byteLength)
      throw Error("The WAV file is truncated.");
    if (kind === "fmt ") {
      if (
        format ||
        size < 16 ||
        v.getUint16(start, true) !== 1 ||
        ![1, 2].includes(v.getUint16(start + 2, true)) ||
        v.getUint16(start + 14, true) !== 16
      )
        throw Error("Use 16-bit PCM WAV, mono or stereo.");
      const channels = v.getUint16(start + 2, true),
        sr = v.getUint32(start + 4, true),
        align = v.getUint16(start + 12, true);
      if (
        sr < 8000 ||
        sr > 96000 ||
        align !== channels * 2 ||
        v.getUint32(start + 8, true) !== sr * align
      )
        throw Error("The WAV sample format is unsupported.");
      format = { channels, rate: sr, align };
    }
    if (kind === "data") {
      if (data !== undefined || !size)
        throw Error("The WAV audio data is invalid.");
      data = size;
    }
    at = next;
  }
  if (!format || data === undefined || data % format.align)
    throw Error("The WAV file has no valid audio.");
  const seconds = data / (format.rate * format.align);
  if (seconds < 0.2 || seconds > maxSeconds)
    throw Error("Choose a recording between 1 and 60 seconds.");
  return seconds;
}
export function encodeVoice(
  buffer: Pick<
    AudioBuffer,
    "length" | "sampleRate" | "duration" | "numberOfChannels" | "getChannelData"
  >,
): Blob {
  if (
    !Number.isFinite(buffer.duration) ||
    buffer.duration <= 0 ||
    buffer.duration > maxSeconds ||
    buffer.sampleRate !== rate ||
    buffer.numberOfChannels < 1 ||
    buffer.numberOfChannels > 2 ||
    buffer.length > rate * maxSeconds
  )
    throw Error("This voice recording cannot be exported.");
  const out = new ArrayBuffer(44 + buffer.length * 2),
    v = new DataView(out),
    word = (at: number, s: string) => {
      for (let i = 0; i < s.length; i++) v.setUint8(at + i, s.charCodeAt(i));
    };
  word(0, "RIFF");
  v.setUint32(4, out.byteLength - 8, true);
  word(8, "WAVE");
  word(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  word(36, "data");
  v.setUint32(40, buffer.length * 2, true);
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  for (let i = 0; i < buffer.length; i++) {
    const mean = channels.reduce((n, c) => n + c[i], 0) / channels.length,
      sample = Number.isFinite(mean) ? Math.max(-1, Math.min(1, mean)) : 0;
    v.setInt16(
      44 + i * 2,
      Math.round(sample * (sample < 0 ? 32768 : 32767)),
      true,
    );
  }
  return new Blob([out], { type: "audio/wav" });
}
async function canonical(buffer: ArrayBuffer) {
  const context = new OfflineAudioContext(1, 1, rate),
    audio = await context.decodeAudioData(buffer);
  return { blob: encodeVoice(audio), seconds: audio.duration };
}
export async function importVoice(
  file: File,
  text: string,
): Promise<PersonalRecording> {
  if (file.size > maxBytes)
    throw Error("Choose a PCM WAV file under 5 MB, up to 60 seconds.");
  const input = await file.arrayBuffer();
  validateVoiceWav(input);
  const { blob, seconds } = await canonical(input);
  return {
    id: crypto.randomUUID(),
    text,
    mime: "audio/wav",
    seconds,
    createdAt: new Date().toISOString(),
    blob,
  };
}
export async function exportVoice(clip: PersonalRecording): Promise<Blob> {
  if (
    clip.blob.size > maxBytes ||
    clip.seconds <= 0 ||
    clip.seconds > maxSeconds
  )
    throw Error("This recording exceeds the export limits.");
  return (await canonical(await clip.blob.arrayBuffer())).blob;
}
