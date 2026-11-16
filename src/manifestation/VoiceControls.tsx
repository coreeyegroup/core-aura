import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { engine } from "../audio/engine";
import { Capacitor } from "@capacitor/core";
import { Play, Square } from "lucide-react";
import { deliverFile } from "../files/deliver";
import { importVoice, exportVoice } from "./voice-files";
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
  label,
}: {
  line: Line;
  id: string;
  recorded?: boolean;
  label?: string;
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
        aria-label={
          label
            ? playing
              ? "Stop voice test"
              : label
            : `${playing ? "Stop preview" : "Play preview"}: ${line.text}`
        }
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
        {playing ? (
          <Square size={16} aria-hidden="true" />
        ) : (
          <Play size={16} aria-hidden="true" />
        )}
        <span>{playing ? "Stop" : label ? "Test voice" : "Play"}</span>
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
    alive = useRef(true),
    fileInput = useRef<HTMLInputElement>(null),
    preview = useRef<HTMLAudioElement>(null),
    currentPhase = useRef("idle");
  const [phase, setPhase] = useState<
      "idle" | "asking" | "recording" | "processing" | "ready" | "saving"
    >("idle"),
    [clip, setClip] = useState<PersonalRecording>(),
    [url, setUrl] = useState(""),
    [error, setError] = useState("");
  const [saved, setSaved] = useState<PersonalRecording[]>([]);
  currentPhase.current = phase;
  useEffect(() => {
    void recordings()
      .then((rows) => {
        if (alive.current) setSaved(rows.filter((c) => c.text === line.text));
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    alive.current = true;
    dialog.current?.showModal();
    const hide = () => {
      if (document.hidden) {
        preview.current?.pause();
        if (["asking", "recording"].includes(currentPhase.current)) {
          controller.current?.abort();
          onClose();
        }
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
      <input
        className="sr-only"
        type="file"
        accept="audio/wav,audio/x-wav,.wav"
        aria-label="Import sentence WAV"
        ref={fileInput}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          manifestPlayer.stop();
          engine.stopAll();
          setError("");
          setPhase("processing");
          void importVoice(file, line.text)
            .then((value) => {
              if (alive.current) {
                setClip(value);
                setPhase("ready");
              }
            })
            .catch((e) => {
              if (alive.current) {
                setError(e.message);
                setPhase("idle");
              }
            });
        }}
      />
      {phase === "idle" && saved.length > 0 && (
        <label>
          Saved voice for these words
          <select
            aria-label="Saved voice for these words"
            defaultValue=""
            onChange={(e) => {
              const value = saved.find((c) => c.id === e.target.value);
              if (value) {
                setClip(value);
                setPhase("ready");
              }
            }}
          >
            <option value="" disabled>
              Choose a recording
            </option>
            {saved.map((c) => (
              <option key={c.id} value={c.id}>
                {new Date(c.createdAt).toLocaleString()} ·{" "}
                {Math.round(c.seconds)} sec
              </option>
            ))}
          </select>
        </label>
      )}
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
          ref={preview}
          onPlay={() => {
            manifestPlayer.stop();
            engine.stopAll();
          }}
          src={url}
          aria-label="Your recording preview"
        />
      )}
      {phase === "ready" && (
        <p className="content-note">
          Listen and confirm that the recording matches the sentence above
          before using it.
        </p>
      )}
      <div className="admin-actions">
        {phase === "idle" && (
          <button onClick={() => fileInput.current?.click()}>Import WAV</button>
        )}
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
export function PersonalVoices({
  initiallyOpen = false,
}: {
  initiallyOpen?: boolean;
}) {
  const panel = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(initiallyOpen);
  useEffect(() => {
    if (initiallyOpen) panel.current?.scrollIntoView({ block: "start" });
  }, [initiallyOpen]);
  const playback = useSyncExternalStore(
    manifestPlayer.subscribe,
    manifestPlayer.snapshot,
  );
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
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
    <details
      className="personal-voices"
      ref={panel}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary>My voice recordings ({clips.length})</summary>
      <p className="content-note">
        Stored on this device, up to 100 clips / 50 MB. Practice JSON backups
        contain sentences and settings; export WAV recordings separately to keep
        reimportable audio copies.
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
              disabled={busy}
              onClick={() => {
                setBusy(true);
                setError("");
                void exportVoice(c)
                  .then((blob) =>
                    deliverFile(blob, `core-aura-voice-${c.id}.wav`),
                  )
                  .then(setMessage)
                  .catch((e) => setError(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              {Capacitor.isNativePlatform() ? "Share WAV" : "Download WAV"}
            </button>
            <button
              disabled={["playing", "paused"].includes(playback.status)}
              onClick={() => {
                try {
                  const { draft } = store.snapshot().data;
                  const existing = draft.lines.find((l) => l.text === c.text);
                  if (!existing && draft.lines.length >= 50)
                    throw Error("Choose up to 50 sentences.");
                  const line = {
                    id: existing?.id || crypto.randomUUID(),
                    text: c.text,
                    recordingId: c.id,
                    recordedText: c.text,
                  };
                  store.draft({
                    ...draft,
                    useRecordings: true,
                    lines: existing
                      ? draft.lines.map((l) =>
                          l.id === existing.id ? line : l,
                        )
                      : [...draft.lines, line],
                  });
                  setMessage("Recording added to your current practice.");
                } catch (e) {
                  setError((e as Error).message);
                }
              }}
            >
              Use in practice
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
      {(error || message) && <p role="status">{error || message}</p>}
    </details>
  );
}
