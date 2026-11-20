import { useEffect, useRef, useState } from "react";
import { affirmationLibrary, type LibraryItem } from "./library";
import { deleteRecording, renameRecording, type PersonalRecording } from "./recordings";
import { manifestationStore } from "./store";
import { manifestPlayer } from "./player";

export type EditLibrary =
  | { kind: "affirmation-add" | "affirmation-edit" | "affirmation-delete"; item?: LibraryItem }
  | { kind: "audio-edit" | "audio-delete"; clip: PersonalRecording };

export function LibraryEditor({ edit, onClose }: { edit: EditLibrary; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const clip = "clip" in edit ? edit.clip : undefined;
  const item = "item" in edit ? edit.item : undefined;
  const [text, setText] = useState(clip?.title ?? clip?.text ?? item?.text ?? "");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const deleting = edit.kind.endsWith("-delete");
  const title = deleting ? "Delete affirmation" : item || clip ? "Edit affirmation" : "Add affirmation";
  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} className="voice-dialog" aria-labelledby="library-edit-title" onCancel={event => {
      event.preventDefault();
      if (!busy) onClose();
    }}>
      <form onSubmit={async event => {
        event.preventDefault();
        if (busy) return;
        try {
          if (clip) {
            setBusy(true);
            if (deleting) {
              const { draft, plans } = manifestationStore.snapshot().data;
              if ([draft, ...plans].some(plan => plan.lines.some(line => line.recordingId === clip.id))) {
                throw Error("This audio is used in a practice. Remove it from the practice and save your changes before deleting.");
              }
              if (manifestPlayer.snapshot().plan?.id === "preview-" + clip.id) manifestPlayer.endPreview();
              await deleteRecording(clip.id);
            } else {
              await renameRecording(clip.id, text);
            }
          } else if (deleting && item) affirmationLibrary.remove(item.id);
          else affirmationLibrary.saveText(item?.id ?? crypto.randomUUID(), text);
          onClose();
        } catch (e) {
          setError((e as Error).message);
          setBusy(false);
        }
      }}>
        <h2 id="library-edit-title">{title}</h2>
        {deleting ? <p>Delete “{text}” from your list?</p> : clip ? (
          <label>Affirmation name
            <input autoFocus required maxLength={80} disabled={busy} value={text} onChange={event => setText(event.target.value)} />
          </label>
        ) : (
          <label>Affirmation text
            <textarea autoFocus required maxLength={300} value={text} onChange={event => setText(event.target.value)} />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="admin-actions">
          <button type="button" disabled={busy} onClick={onClose}>Back to affirmations</button>
          <button className="primary" type="submit" disabled={busy}>{deleting ? "Confirm delete" : "Save affirmation"}</button>
        </div>
      </form>
    </dialog>
  );
}
