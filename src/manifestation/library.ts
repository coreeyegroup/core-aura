import { affirmations, categories } from "./model";
export type LibraryItem = { id: string; text: string; category: string };
export type AffirmationLibrary = {
  schemaVersion: 1;
  categories: string[];
  affirmations: LibraryItem[];
};
export function parseLibrary(value: unknown): AffirmationLibrary {
  const v = value as AffirmationLibrary;
  if (
    !v ||
    v.schemaVersion !== 1 ||
    !Array.isArray(v.categories) ||
    v.categories.length > 50 ||
    !v.categories.every(
      (c) =>
        typeof c === "string" &&
        c.trim() === c &&
        c.length > 0 &&
        c.length <= 50,
    ) ||
    new Set(v.categories.map((c) => c.toLocaleLowerCase())).size !==
      v.categories.length ||
    !Array.isArray(v.affirmations) ||
    v.affirmations.length > 1000 ||
    v.affirmations.some(
      (a) =>
        !a ||
        typeof a.id !== "string" ||
        !/^[a-zA-Z0-9-]{1,100}$/.test(a.id) ||
        typeof a.text !== "string" ||
        !a.text.trim() ||
        a.text.length > 300 ||
        !v.categories.includes(a.category),
    ) ||
    new Set(v.affirmations.map((a) => a.id)).size !== v.affirmations.length
  )
    throw Error(
      "The affirmation library is invalid. Use up to 50 categories and 1,000 affirmations.",
    );
  return structuredClone(v);
}
const key = "core-aura.affirmation-library.v1";
const defaults = (): AffirmationLibrary => ({
  schemaVersion: 1,
  categories: [...categories],
  affirmations: structuredClone(affirmations),
});
function load() {
  try {
    const raw = localStorage.getItem(key);
    return {
      data: raw ? parseLibrary(JSON.parse(raw)) : defaults(),
      error: "",
    };
  } catch {
    return {
      data: defaults(),
      error:
        "Your saved affirmation library could not be read. It has been preserved; restore a valid library backup before making changes.",
    };
  }
}
let state = load();
const listeners = new Set<() => void>();
function commit(data: AffirmationLibrary) {
  if (state.error) throw Error(state.error);
  const clean = parseLibrary(data);
  try {
    localStorage.setItem(key, JSON.stringify(clean));
  } catch {
    throw Error("The library could not be saved. Check device storage.");
  }
  state = { data: clean, error: "" };
  listeners.forEach((f) => f());
}
export const affirmationLibrary = {
  snapshot: () => state,
  subscribe: (f: () => void) => {
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  },
  reorderCategory: (name:string,direction:number)=>{const rows=[...state.data.categories],index=rows.indexOf(name),next=index+direction;if(index<0||next<0||next>=rows.length)return;[rows[index],rows[next]]=[rows[next],rows[index]];commit({...state.data,categories:rows});},
  addCategory: (name: string) => {
    const category = name.trim();
    commit({ ...state.data, categories: [...state.data.categories, category] });
    return category;
  },
  renameCategory: (from: string, name: string) => {
    const to = name.trim();
    if (!state.data.categories.includes(from))
      throw Error("Category no longer exists.");
    commit({
      ...state.data,
      categories: state.data.categories.map((c) => (c === from ? to : c)),
      affirmations: state.data.affirmations.map((a) =>
        a.category === from ? { ...a, category: to } : a,
      ),
    });
    return to;
  },
  deleteCategory: (name: string, moveTo: string) => {
    if (moveTo === name || (moveTo && !state.data.categories.includes(moveTo)))
      throw Error("Choose another category.");
    commit({
      ...state.data,
      categories: state.data.categories.filter((c) => c !== name),
      affirmations: moveTo
        ? state.data.affirmations.map((a) =>
            a.category === name ? { ...a, category: moveTo } : a,
          )
        : state.data.affirmations.filter((a) => a.category !== name),
    });
  },
  save: (item: LibraryItem) => {
    const previous = state.data.affirmations.find((a) => a.id === item.id);
    const rows = state.data.affirmations.filter((a) => a.id !== item.id);
    if (
      rows.some(
        (a) =>
          a.category === item.category &&
          a.text.trim().toLocaleLowerCase() ===
            item.text.trim().toLocaleLowerCase(),
      )
    )
      throw Error("This category already contains that affirmation.");
    commit({
      ...state.data,
      affirmations: previous
        ? state.data.affirmations.map((a) =>
            a.id === item.id ? { ...item, text: item.text.trim() } : a,
          )
        : [...rows, { ...item, text: item.text.trim() }],
    });
  },
  saveText: (id: string, value: string) => {
    const text = value.trim();
    if (!text || text.length > 300) throw Error("Enter 1–300 characters.");
    const data = state.data;
    if (data.affirmations.some(item => item.id !== id && item.text.toLowerCase() === text.toLowerCase()))
      throw Error("That affirmation is already in your list.");
    const previous = data.affirmations.find(item => item.id === id);
    const categories = data.categories.length ? data.categories : ["General"];
    commit({
      ...data, categories,
      affirmations: previous ? data.affirmations.map(item => item.id === id ? { ...item, text } : item)
        : [...data.affirmations, { id, text, category: categories[0] }],
    });
  },
  importTexts: (value: unknown) => {
    const input = value as { schemaVersion?: number; affirmations?: unknown[]; categories?: unknown[] } | null;
    if (input?.schemaVersion !== 1 || !Array.isArray(input.affirmations) || input.affirmations.length > 1000)
      throw Error("Choose a valid affirmations JSON file.");
    const values = Array.isArray(input.categories) ? parseLibrary(input).affirmations.map(item => item.text) : input.affirmations;
    if (values.some(text => typeof text !== "string" || !text.trim() || text.trim().length > 300))
      throw Error("Each affirmation must contain 1–300 characters.");
    const data = state.data;
    const categories = data.categories.length ? data.categories : ["General"];
    const affirmations = [...data.affirmations];
    const seen = new Set(affirmations.map(item => item.text.toLowerCase()));
    for (const entry of values as string[]) {
      const text = entry.trim(), key = text.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      affirmations.push({ id: crypto.randomUUID(), text, category: categories[0] });
    }
    if (affirmations.length !== data.affirmations.length) commit({ ...data, categories, affirmations });
    return affirmations.length - data.affirmations.length;
  },
  remove: (id: string) =>
    commit({
      ...state.data,
      affirmations: state.data.affirmations.filter((a) => a.id !== id),
    }),
  restore: (value: unknown) => {
    const data = parseLibrary(value);
    try {
      localStorage.setItem(key, JSON.stringify(data));
    } catch {
      throw Error("The library backup could not be saved.");
    }
    state = { data, error: "" };
    listeners.forEach((f) => f());
  },
};
if (typeof window !== "undefined")
  addEventListener("storage", (e) => {
    if (e.key === key) {
      state = load();
      listeners.forEach((f) => f());
    }
  });
