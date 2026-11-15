import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { engine } from "../audio/engine";
import { Capacitor } from "@capacitor/core";
import { Line } from "./model";
import { manifestPlayer } from "./player";
import { manifestationStore as store } from "./store";
import { captureVoice, Capture } from "./capture";
import {
  PersonalRecording,
  saveRecording,
  recordings,
  deleteRecording,
} from "./recordings";
export function PreviewButton({
  line,
  id,
  recorded = false,
}: {
  line: Line;
  id: string;
  recorded?: boolean;
}) {
  const state = useSyncExternalStore(
      manifestPlayer.subscribe,
      manifestPlayer.snapshot,
    ),
    [error, setError] = useState("");
  const playing =
    state.plan?.id === `preview-${id}` &&
    ["playing", "paused"].includes(state.status);
  return (
    <>
      <button
        className="preview-button"
        disabled={!line.text.trim()}
        aria-label={`${playing ? "Stop preview" : "Play preview"}: ${line.text}`}
        onClick={() => {
          try {
            setError("");
            if (playing) manifestPlayer.stop();
            else
              manifestPlayer.start({
                ...store.snapshot().data.draft,
                id: `preview-${id}`,
                name: "Sentence preview",
                lines: [line],
                repeats: 1,
                seconds: 60,
                gap: 0,
                mode: "speech",
                background: null,
                useRecordings: recorded,
              });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        {playing ? "■ Stop" : "▶ Play"}
      </button>
      {(error || (state.plan?.id === `preview-${id}` && state.error)) && (
        <span className="preview-error" role="status">
          {error || state.error}
        </span>
      )}
    </>
  );
}
export function RecordSentence({
  line,
  onSave,
  onClose,
}: {
  line: Line;
  onSave: (clip: PersonalRecording) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    session = useRef<Capture | undefined>(undefined),
    controller = useRef<AbortController | undefined>(undefined),
    alive = useRef(true);
  const [phase, setPhase] = useState<
      "idle" | "asking" | "recording" | "processing" | "ready" | "saving"
    >("idle"),
    [clip, setClip] = useState<PersonalRecording>(),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    const hide = () => {
      if (document.hidden) {
        controller.current?.abort();
        onClose();
      }
    };
    document.addEventListener("visibilitychange", hide);
    return () => {
      alive.current = false;
      controller.current?.abort();
      document.removeEventListener("visibilitychange", hide);
    };
  }, []);
  useEffect(() => {
    if (!clip) return;
    const value = URL.createObjectURL(clip.blob);
    setUrl(value);
    return () => URL.revokeObjectURL(value);
  }, [clip]);
  async function start() {
    manifestPlayer.stop();
    engine.stopAll();
    setError("");
    setClip(undefined);
    setPhase("asking");
    const abort = new AbortController();
    controller.current = abort;
    try {
      const capture = await captureVoice(abort.signal);
      session.current = capture;
      if (!alive.current) {
        capture.cancel();
        void capture.result.catch(() => {});
        return;
      }
      setPhase("recording");
      const blob = await capture.result;
      if (!alive.current) return;
      setPhase("processing");
      const ctx = new OfflineAudioContext(1, 1, 44100),
        audio = await ctx.decodeAudioData(await blob.arrayBuffer());
      if (!alive.current) return;
      const value = {
        id: crypto.randomUUID(),
        text: line.text,
        mime: blob.type,
        seconds: audio.duration,
        createdAt: new Date().toISOString(),
        blob,
      };
      if (value.seconds > 65 || value.seconds < 0.2)
        throw Error("Record between 1 and 60 seconds.");
      setClip(value);
      setPhase("ready");
    } catch (e) {
      if (alive.current) {
        setError((e as Error).message);
        setPhase("idle");
      }
    }
  }
  return (
    <dialog
      ref={dialog}
      className="voice-dialog"
      onCancel={onClose}
      aria-labelledby="record-heading"
    >
      <h2 id="record-heading">Record your sentence</h2>
      <p>{line.text}</p>
      <p className="content-note">
        Up to 60 seconds. Recordings stay on this device. Stop and listen before
        saving.
      </p>
      <p role="status">
        {phase === "asking"
          ? "Waiting for microphone permission…"
          : phase === "recording"
            ? "Recording… microphone is on."
            : phase === "processing"
              ? "Preparing preview…"
              : error}
      </p>
      {url && phase === "ready" && (
        <audio
          controls
          onPlay={() => {
            manifestPlayer.stop();
            engine.stopAll();
          }}
          src={url}
          aria-label="Your recording preview"
        />
      )}
      <div className="admin-actions">
        {["idle", "ready"].includes(phase) && (
          <button onClick={() => void start()}>
            {clip ? "Record again" : "Start recording"}
          </button>
        )}
        {phase === "recording" && (
          <button className="primary" onClick={() => session.current?.stop()}>
            Finish recording
          </button>
        )}
        {phase === "ready" && clip && (
          <button
            className="primary"
            onClick={() => {
              setPhase("saving");
              void saveRecording(clip)
                .then(() => {
                  if (alive.current) onSave(clip);
                })
                .catch((e) => {
                  if (alive.current) {
                    setError(e.message);
                    setPhase("ready");
                  }
                });
            }}
          >
            Use recording
          </button>
        )}
        <button disabled={phase === "saving"} onClick={onClose}>
          Cancel
        </button>
      </div>
    </dialog>
  );
}
export function PersonalVoices() {
  const [clips, setClips] = useState<PersonalRecording[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    const read = () =>
      void recordings()
        .then((c) => {
          if (alive) setClips(c);
        })
        .catch((e) => {
          if (alive) setError(e.message);
        });
    read();
    addEventListener("core-aura-recordings-changed", read);
    return () => {
      alive = false;
      removeEventListener("core-aura-recordings-changed", read);
    };
  }, []);
  return (
    <details className="personal-voices">
      <summary>My voice recordings ({clips.length})</summary>
      <p className="content-note">
        Stored on this device, up to 100 clips / 50 MB. Practice JSON backups
        contain sentences and settings; download recordings separately to keep
        audio copies.
      </p>
      {clips.map((c) => (
        <article className="saved-card" key={c.id}>
          <p>{c.text}</p>
          <div className="admin-actions">
            <PreviewButton
              id={"clip-" + c.id}
              line={{
                id: c.id,
                text: c.text,
                recordingId: c.id,
                recordedText: c.text,
              }}
              recorded
            />
            <button
              disabled={Capacitor.isNativePlatform()}
              title={
                Capacitor.isNativePlatform()
                  ? "Native file sharing is pending."
                  : undefined
              }
              onClick={() => {
                const url = URL.createObjectURL(c.blob),
                  a = document.createElement("a");
                a.href = url;
                a.download = `core-aura-voice-${c.id}.${c.mime.includes("mp4") ? "m4a" : c.mime.includes("ogg") ? "ogg" : "webm"}`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 60000);
              }}
            >
              Download
            </button>
            <button
              onClick={() => {
                if (
                  !confirm(
                    "Delete this recording? Practices will return to the device voice for this sentence.",
                  )
                )
                  return;
                manifestPlayer.stop();
                try {
                  store.detachRecording(c.id);
                  void deleteRecording(c.id).catch((e) => setError(e.message));
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Delete recording
            </button>
          </div>
        </article>
      ))}
      {!clips.length && (
        <p>
          No recordings yet. Use Record voice beside a sentence in your
          practice.
        </p>
      )}
      {error && <p role="status">{error}</p>}
    </details>
  );
}
