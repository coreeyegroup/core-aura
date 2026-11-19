import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { engine } from "../audio/engine";
import { Capacitor } from "@capacitor/core";
import { Mic, Play, Square, Upload } from "lucide-react";
import { deliverFile } from "../files/deliver";
import { importVoice, exportVoice } from "./voice-files";
import { speech, type Voice } from "./speech";
import { coreVoices } from "./server-voice";
import { Line } from "./model";
import { manifestPlayer } from "./player";
import { manifestationStore as store } from "./store";
import { captureVoice, Capture } from "./capture";
import {
  PersonalRecording,
  saveRecording,
  recordings,
  deleteRecording,
  renameRecording,
} from "./recordings";
export function PreviewButton({
  line,
  id,
  recorded = false,
  label,
  voice,
  catalog = false,
  iconOnly = false,
}: {
  line: Line;
  id: string;
  recorded?: boolean;
  label?: string;
  voice?: string;
  catalog?: boolean;
  iconOnly?: boolean;
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
        className={iconOnly ? "icon-button preview-button" : "preview-button"}
        title={iconOnly ? playing ? "Stop test" : "Test play" : undefined}
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
            if (playing) manifestPlayer.endPreview();
            else
              manifestPlayer.preview({
                ...store.snapshot().data.draft,
                id: `preview-${id}`,
                name: "Sentence preview",
                lines: [line],
                repeats: 1,
                seconds: 60,
                gap: 0,
                mode: "speech",
                voice: voice ?? store.snapshot().data.draft.voice,
                background: null,
                backgroundMix: null,
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
        {!iconOnly && <span>{playing ? "Stop" : catalog ? "Test play" : label ? "Test voice" : "Play"}</span>}
      </button>
      {(error || (state.plan?.id === `preview-${id}` && state.error)) && (
        <span className="preview-error" role="status">
          <span>{error || state.error}</span>
          {!catalog && <button
            onClick={(event) => {
              const panel = event.currentTarget
                .closest(".manifest-workspace")
                ?.querySelector<HTMLDetailsElement>(".voice-panel");
              if (panel) {
                panel.open = true;
                panel.scrollIntoView({ block: "start" });
              }
            }}
          >
            Voice settings
          </button>}
        </span>
      )}
    </>
  );
}
export function RecordSentence({
  line,
  onSave,
  onClose,
  closeLabel = "Cancel",
  saveLabel = "Use recording",
}: {
  line: Line;
  onSave: (clip: PersonalRecording) => void;
  onClose: () => void;
  closeLabel?: string;
  saveLabel?: string;
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
            {saveLabel}
          </button>
        )}
        <button disabled={phase === "saving"} onClick={onClose}>
          {closeLabel}
        </button>
      </div>
    </dialog>
  );
}
export function DefaultVoiceList() {
  const [voices, setVoices] = useState<Voice[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const [device, core] = await Promise.all([speech.voices().catch(() => []), coreVoices()]);
      if (!alive) return;
      setVoices([...new Map([...device, ...core].map(voice => [voice.voiceURI, voice])).values()]);
      setLoading(false);
    };
    load();
    window.speechSynthesis?.addEventListener("voiceschanged", load);
    return () => { alive = false; window.speechSynthesis?.removeEventListener("voiceschanged", load); };
  }, []);

  const available = [{ name: "Device default", lang: "System language", voiceURI: "", localService: true },
    ...voices.filter(voice => voice.voiceURI)];
  return (
    <section aria-label="Default voices" className="library-starters">
      <h2>Default voices</h2>
      {loading && <p role="status">Checking available voices…</p>}
      {available.map((voice, index) => (
        <article className="library-starter" key={voice.voiceURI}>
          <div><h3>{voice.name}</h3><small>{voice.lang}</small></div>
          <PreviewButton line={{ id: "voice-sample", text: "I can return to a moment of calm." }}
            id={"default-voice-" + index} voice={voice.voiceURI} label={"Test play " + voice.name} catalog />
        </article>
      ))}
    </section>
  );
}

function ImportRecording({ file, onCancel, onSave }: { file: File; onCancel: () => void; onSave: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { dialog.current?.showModal(); }, []);
  return <dialog className="voice-dialog" ref={dialog} aria-labelledby="import-voice-title" onCancel={event => {
    event.preventDefault();
    if (!saving) onCancel();
  }}>
    <form onSubmit={event => {
      event.preventDefault();
      if (saving || !text.trim()) return;
      setSaving(true);
      setError("");
      void importVoice(file, text.trim()).then(saveRecording).then(onSave).catch(error => {
        setError(error.message);
        setSaving(false);
      });
    }}>
      <h2 id="import-voice-title">Import voice WAV</h2>
      <p>{file.name}</p>
      <label>Words in the recording<input required autoFocus maxLength={300} value={text} onChange={event => setText(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <div className="catalog-footer">
        <button type="button" disabled={saving} onClick={onCancel}>Back to voices</button>
        <button className="primary" disabled={saving || !text.trim()}>Save to Library</button>
      </div>
    </form>
  </dialog>;
}

export function PersonalVoices({
  initiallyOpen = false,
  allowAttach = true,
}: {
  initiallyOpen?: boolean;
  allowAttach?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  const [newText, setNewText] = useState("");
  const [recordLine, setRecordLine] = useState<Line>();
  const [importFile, setImportFile] = useState<File>();
  const importInput = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setOpen(initiallyOpen);
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
          <div><strong>{c.title || c.text}</strong>{c.title && <p className="content-note">{c.text}</p>}</div>
          <div className="admin-actions">
            <button disabled={busy} onClick={() => {
              const title = prompt("Recording name", c.title || "");
              if (title === null) return;
              setError("");
              setBusy(true);
              void renameRecording(c.id, title).catch(error => setError(error.message)).finally(() => setBusy(false));
            }}>Edit name</button>
            <PreviewButton
              id={"clip-" + c.id}
              line={{
                id: c.id,
                text: c.text,
                recordingId: c.id,
                recordedText: c.text,
              }}
              recorded
              catalog
              label={"Test play " + (c.title || c.text)}
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
            {allowAttach && <button
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
            </button>}
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
          No recordings yet. Record a voice or import a WAV file, or record beside a sentence in your
          practice.
        </p>
      )}
      <form className="voice-library-add" onSubmit={event => {
        event.preventDefault();
        if (newText.trim()) setRecordLine({ id: crypto.randomUUID(), text: newText.trim() });
      }}>
        <label>Words in the recording
          <input value={newText} maxLength={300} onChange={event => setNewText(event.target.value)} />
        </label>
        <button className="primary" disabled={!newText.trim() || busy || ["playing", "paused"].includes(playback.status)}>
          <Mic size={16} aria-hidden="true" /> Record voice
        </button>
      </form>
      {recordLine && <RecordSentence line={recordLine} saveLabel="Save to Library" closeLabel="Back to voices"
        onClose={() => setRecordLine(undefined)}
        onSave={() => {
          setRecordLine(undefined);
          setNewText("");
          setMessage("Recording saved in Library.");
        }} />}
      <div className="catalog-footer">
        <button disabled={busy || ["playing", "paused"].includes(playback.status)} onClick={() => importInput.current?.click()}><Upload size={16} aria-hidden="true" /> Import voice WAV</button>
        <input ref={importInput} className="sr-only" type="file" accept="audio/wav,audio/x-wav,.wav"
          aria-label="Import voice WAV from device" onChange={event => {
            setImportFile(event.target.files?.[0]);
            event.target.value = "";
          }} />
      </div>
      {importFile && <ImportRecording file={importFile} onCancel={() => setImportFile(undefined)} onSave={() => {
        setImportFile(undefined);
        setMessage("Recording saved in Library.");
      }} />}
      {(error || message) && <p role="status">{error || message}</p>}
    </details>
  );
}
