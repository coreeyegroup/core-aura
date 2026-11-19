import { useEffect, useRef, useState } from "react";
import { affirmationLibrary, type LibraryItem } from "./library";

export type EditLibrary = {
  kind: "affirmation-add" | "affirmation-edit" | "affirmation-delete";
  item?: LibraryItem;
};

export function LibraryEditor({ edit, onClose }: { edit: EditLibrary; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [text, setText] = useState(edit.item?.text ?? "");
  const [error, setError] = useState("");
  const deleting = edit.kind === "affirmation-delete";
  const title = deleting ? "Delete affirmation" : edit.item ? "Edit affirmation" : "Add affirmation";
  useEffect(() => { dialog.current?.showModal(); }, []);

  return (
    <dialog ref={dialog} className="voice-dialog" aria-labelledby="library-edit-title" onCancel={onClose}>
      <form onSubmit={event => {
        event.preventDefault();
        try {
          if (deleting && edit.item) affirmationLibrary.remove(edit.item.id);
          else affirmationLibrary.saveText(edit.item?.id ?? crypto.randomUUID(), text);
          onClose();
        } catch (e) { setError((e as Error).message); }
      }}>
        <h2 id="library-edit-title">{title}</h2>
        {deleting ? <p>Delete “{text}” from your list?</p> : (
          <label>Affirmation text
            <textarea autoFocus required maxLength={300} value={text} onChange={event => setText(event.target.value)} />
          </label>
        )}
        {error && <p role="alert">{error}</p>}
        <div className="admin-actions">
          <button type="button" onClick={onClose}>Back to affirmations</button>
          <button className="primary" type="submit">{deleting ? "Confirm delete" : "Save affirmation"}</button>
        </div>
      </form>
    </dialog>
  );
}
