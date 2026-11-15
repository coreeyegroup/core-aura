import { newPlan, parsePlan, parseReminders, Plan, Reminder } from "./model";
const key = "core-aura.manifestation.v1";
type Data = {
  schemaVersion: 1;
  draft: Plan;
  plans: Plan[];
  reminders: Reminder[];
};
function load(): { data: Data; error: string } {
  const empty: Data = {
    schemaVersion: 1,
    draft: newPlan(),
    plans: [],
    reminders: [],
  };
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { data: empty, error: "" };
    const v = JSON.parse(raw);
    if (
      v.schemaVersion !== 1 ||
      !Array.isArray(v.plans) ||
      v.plans.length > 100
    )
      throw Error();
    const plans = v.plans.map((p: unknown) => parsePlan(p));
    if (new Set(plans.map((p: Plan) => p.id)).size !== plans.length)
      throw Error();
    return {
      data: {
        schemaVersion: 1,
        draft: parsePlan(v.draft, true),
        plans,
        reminders: parseReminders(v.reminders, plans),
      },
      error: "",
    };
  } catch {
    return {
      data: empty,
      error:
        "Saved manifestation data could not be read. Existing data has been preserved; restore a practice backup or check browser storage.",
    };
  }
}
let state = load();
const listeners = new Set<() => void>();
function commit(data: Data) {
  if (state.error) throw Error(state.error);
  try {
    localStorage.setItem(key, JSON.stringify(data));
  } catch {
    throw Error(
      "Manifestation settings could not be saved. Free device storage and try again.",
    );
  }
  state = { data, error: "" };
  listeners.forEach((f) => f());
}
export const manifestationStore = {
  snapshot: () => state,
  subscribe: (f: () => void) => {
    listeners.add(f);
    return () => {
      listeners.delete(f);
    };
  },
  draft: (draft: Plan) =>
    commit({ ...state.data, draft: parsePlan(draft, true) }),
  save: () => {
    const p = parsePlan(state.data.draft),
      others = state.data.plans.filter((row) => row.id !== p.id);
    if (others.length >= 100)
      throw Error("The library supports up to 100 practices.");
    commit({ ...state.data, plans: [...others, p] });
    return p;
  },
  open: (id: string) => {
    const p = state.data.plans.find((row) => row.id === id);
    if (!p) throw Error("This practice is unavailable.");
    commit({ ...state.data, draft: structuredClone(p) });
  },
  fresh: () => commit({ ...state.data, draft: newPlan() }),
  remove: (id: string) =>
    commit({
      ...state.data,
      plans: state.data.plans.filter((p) => p.id !== id),
      reminders: state.data.reminders.filter((r) => r.planId !== id),
      draft: state.data.draft.id === id ? newPlan() : state.data.draft,
    }),
  import: (value: unknown) => {
    const p = parsePlan(value);
    p.id = crypto.randomUUID();
    if (state.data.plans.length >= 100)
      throw Error("The library supports up to 100 practices.");
    commit({ ...state.data, plans: [...state.data.plans, p], draft: p });
  },
  reminders: (rows: Reminder[]) =>
    commit({
      ...state.data,
      reminders: parseReminders(rows, state.data.plans),
    }),
};
if (typeof window !== "undefined")
  addEventListener("storage", (e) => {
    if (e.key === key) {
      state = load();
      listeners.forEach((f) => f());
    }
  });
