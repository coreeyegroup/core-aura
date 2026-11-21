import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { X } from "lucide-react";
import { affirmationLibrary } from "./library";
import type { Line } from "./model";
import { manifestPlayer } from "./player";
import { recordings, type PersonalRecording } from "./recordings";
import { PreviewButton } from "./VoiceControls";

const previewPrefix = "picker-affirmation-";

export function AffirmationPicker({ lines, onAdd, onClose, onManage }: {
  lines: Line[];
  onAdd: (items: Line[]) => boolean;
  onClose: () => void;
  onManage: () => void;
}) {
  const catalog = useSyncExternalStore(affirmationLibrary.subscribe, affirmationLibrary.snapshot);
  const dialog = useRef<HTMLDialogElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [type, setType] = useState<"all" | "text" | "audio">("all");
  const [audio, setAudio] = useState<PersonalRecording[]>();
  const [audioError, setAudioError] = useState("");
  const [selected, setSelected] = useState<Line[]>([]);
  const [addError, setAddError] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement;
    element?.showModal();
    search.current?.focus();
    return () => {
      element?.close();
      if (manifestPlayer.snapshot().plan?.id.startsWith("preview-" + previewPrefix)) manifestPlayer.endPreview();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
    };
  }, []);

  useEffect(() => {
    let current = true;
    void recordings("affirmation").then(items => {
      if (current) setAudio(items);
    }).catch(() => {
      if (current) setAudioError("Audio affirmations could not be loaded.");
    });
    return () => { current = false; };
  }, []);

  const textItems = type === "audio" ? [] : catalog.data.affirmations
    .filter(item => !category || item.category === category)
    .map(item => ({ line: { id: item.id, text: item.text } as Line, detail: item.category }));
  const audioItems = type === "text" || category ? [] : (audio ?? []).map(clip => {
    const text = clip.title ?? clip.text;
    return {
      line: { id: clip.id, text, recordedText: text, recordingId: clip.id, audioAffirmation: true } as Line,
      detail: "Audio · " + Math.max(1, Math.round(clip.seconds)) + " sec",
    };
  });
  const term = query.trim().toLocaleLowerCase();
  const items = [...textItems, ...audioItems].filter(({ line }) => line.text.toLocaleLowerCase().includes(term));
  const full = lines.length + selected.length >= 50;

  return <dialog ref={dialog} className="practice-picker" aria-labelledby="affirmation-picker-heading"
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="practice-picker-head">
      <h2 id="affirmation-picker-heading">Choose affirmations</h2>
      <button type="button" className="icon-button" aria-label="Close affirmation picker" onClick={onClose}>
        <X size={18} aria-hidden="true" />
      </button>
    </div>
    <div className="practice-picker-filters">
      <label className="practice-picker-search">Search
        <input ref={search} type="search" value={query} onChange={event => setQuery(event.target.value)} />
      </label>
      <label>Content
        <select value={type} onChange={event => {
          const next = event.target.value as typeof type;
          setType(next);
          if (next === "audio") setCategory("");
        }}>
          <option value="all">Text and audio</option><option value="text">Text</option><option value="audio">Audio</option>
        </select>
      </label>
      {type !== "audio" && <label>Category
        <select value={category} onChange={event => setCategory(event.target.value)}>
          <option value="">All categories</option>
          {catalog.data.categories.map(name => <option key={name}>{name}</option>)}
        </select>
      </label>}
    </div>
    <div className="practice-picker-list">
      {(catalog.error || audioError) && <p role="status">{catalog.error || audioError}</p>}
      {!items.length && <p role="status">{type === "audio" && !audio && !audioError ? "Loading audio affirmations…" : "No matching affirmations."}</p>}
      {items.map(({ line, detail }) => {
        const id = (line.audioAffirmation ? "audio-" : "text-") + line.id;
        const added = lines.some(item => line.audioAffirmation
          ? item.audioAffirmation && item.recordingId === line.recordingId
          : !item.audioAffirmation && item.text === line.text);
        const matches = (item: Line) => item.id === line.id && item.audioAffirmation === line.audioAffirmation;
        const chosen = selected.some(matches);
        return <div className="practice-picker-row" key={id}>
          <label><input type="checkbox" checked={added || chosen} disabled={added || full && !chosen}
            aria-label={line.text} onChange={event => setSelected(current => event.target.checked
              ? [...current, line] : current.filter(item => !matches(item)))} />
            <span>{line.text}<small>{detail}{added ? " · In practice" : ""}</small></span>
          </label>
          <PreviewButton line={line} id={previewPrefix + id} iconOnly catalog />
        </div>;
      })}
    </div>
    <footer className="practice-picker-footer">
      <small role="status">{addError ? "Could not add the selection. Free device storage and try again." :
        selected.length + " selected · " + Math.max(0, 50 - lines.length - selected.length) + " slots left"}</small>
      <div className="home-actions">
        <button type="button" onClick={() => { onClose(); onManage(); }}>Open affirmation library</button>
        <button type="button" onClick={onClose}>Cancel</button>
        <button type="button" className="primary" disabled={!selected.length || selected.length + lines.length > 50} onClick={() => {
          if (onAdd(selected)) onClose();
          else setAddError(true);
        }}>Add selected</button>
      </div>
    </footer>
  </dialog>;
}
