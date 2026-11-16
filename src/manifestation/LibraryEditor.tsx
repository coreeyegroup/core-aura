import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { affirmationLibrary as library, LibraryItem } from "./library";
export type EditLibrary = {
  kind:
    | "category-add"
    | "category-edit"
    | "category-delete"
    | "affirmation-add"
    | "affirmation-edit"
    | "affirmation-delete";
  category: string;
  item?: LibraryItem;
};
export function LibraryEditor({
  edit,
  onClose,
  onCategory,
}: {
  edit: EditLibrary;
  onClose: () => void;
  onCategory: (name: string) => void;
}) {
  const { data } = useSyncExternalStore(library.subscribe, library.snapshot),
    dialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(
      edit.kind === "category-edit" ? edit.category : "",
    ),
    [text, setText] = useState(edit.item?.text || ""),
    [category, setCategory] = useState(edit.item?.category || edit.category),
    [move, setMove] = useState(
      data.categories.find((c) => c !== edit.category) || "",
    ),
    [error, setError] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  const titles = {
    "category-add": "Add category",
    "category-edit": "Rename category",
    "category-delete": "Delete category",
    "affirmation-add": "Add affirmation",
    "affirmation-edit": "Edit affirmation",
    "affirmation-delete": "Delete affirmation",
  };
  return (
    <dialog
      ref={dialog}
      className="voice-dialog"
      aria-labelledby="library-edit-title"
      onCancel={onClose}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          try {
            switch (edit.kind) {
              case "category-add":
                onCategory(library.addCategory(name));
                break;
              case "category-edit":
                onCategory(library.renameCategory(edit.category, name));
                break;
              case "category-delete":
                library.deleteCategory(edit.category, move);
                onCategory(move || library.snapshot().data.categories[0] || "");
                break;
              case "affirmation-add":
                library.save({ id: crypto.randomUUID(), text, category });
                onCategory(category);
                break;
              case "affirmation-edit":
                library.save({ id: edit.item!.id, text, category });
                onCategory(category);
                break;
              case "affirmation-delete":
                library.remove(edit.item!.id);
                break;
            }
            onClose();
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <h2 id="library-edit-title">{titles[edit.kind]}</h2>
        {["category-add", "category-edit"].includes(edit.kind) && (
          <label>
            Category name
            <input
              autoFocus
              maxLength={50}
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {["affirmation-add", "affirmation-edit"].includes(edit.kind) && (
          <>
            <label>
              Category
              <select
                aria-label="Affirmation category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
              >
                {data.categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label>
              Affirmation text
              <textarea
                aria-label="Affirmation text"
                required
                maxLength={300}
                value={text}
                onChange={(e) => setText(e.target.value)}
              />
            </label>
            <p className="content-note">
              Saved practices keep their existing words. Select this updated
              affirmation to use the new wording.
            </p>
          </>
        )}
        {edit.kind === "category-delete" && (
          <>
            <p>
              Delete “{edit.category}”? It contains{" "}
              {
                data.affirmations.filter((a) => a.category === edit.category)
                  .length
              }{" "}
              affirmations.
            </p>
            <label>
              Affirmations in this category
              <select
                aria-label="Category deletion action"
                value={move}
                onChange={(e) => setMove(e.target.value)}
              >
                {data.categories
                  .filter((c) => c !== edit.category)
                  .map((c) => (
                    <option key={c} value={c}>
                      Move to {c}
                    </option>
                  ))}
                <option value="">Delete these affirmations too</option>
              </select>
            </label>
          </>
        )}
        {edit.kind === "affirmation-delete" && (
          <p>Delete “{edit.item?.text}” from the library?</p>
        )}
        {error && <p role="status">{error}</p>}
        <div className="admin-actions">
          <button className="primary" type="submit">
            {edit.kind.endsWith("delete") ? "Confirm delete" : "Save changes"}
          </button>
          <button type="button" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </dialog>
  );
}
