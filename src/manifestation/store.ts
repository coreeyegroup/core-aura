import { newPlan, parsePlan, parseReminders, Plan, Reminder } from "./model";
import { withoutRecordings } from "./recordings";
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
  copy: (id?:string) => {
    const original=id?state.data.plans.find(p=>p.id===id):state.data.draft;
    if(!original)throw Error("Practice unavailable.");
    if(state.data.plans.length>=100)throw Error("The library supports up to 100 practices.");
    const p=parsePlan({...structuredClone(original),id:crypto.randomUUID(),name:(original.name+" copy").slice(0,80)});
    commit({...state.data,plans:[...state.data.plans,p],draft:p});return p;
  },
  addCopy: (value: Plan) => {
    if (state.data.plans.length >= 100) throw Error("The library supports up to 100 practices.");
    const plan = { ...withoutRecordings(parsePlan(value)), id: crypto.randomUUID() };
    commit({ ...state.data, plans: [...state.data.plans, plan] });
  },
  rename: (id:string,name:string) => {
    const original=state.data.plans.find(p=>p.id===id);
    if(!original)throw Error("Practice unavailable.");
    const updated=parsePlan({...original,name:name.trim()});
    commit({...state.data,plans:state.data.plans.map(p=>p.id===id?updated:p),draft:state.data.draft.id===id?{...state.data.draft,name:updated.name}:state.data.draft});
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
    const v=value as {kind?:string;schemaVersion?:number;practices?:unknown[]};
    const items=v?.kind==="core-aura-practice-collection"&&v.schemaVersion===1?v.practices:[value];
    if(!Array.isArray(items)||!items.length||items.length>100||state.data.plans.length+items.length>100)throw Error("The library supports up to 100 practices.");
    const rows=items.map(value=>({...withoutRecordings(parsePlan(value)),id:crypto.randomUUID()}));
    commit({...state.data,plans:[...state.data.plans,...rows],draft:rows[0]});
  },
  removeMany:(ids:string[])=>commit({...state.data,plans:state.data.plans.filter(p=>!ids.includes(p.id)),reminders:state.data.reminders.filter(r=>!ids.includes(r.planId)),draft:ids.includes(state.data.draft.id)?newPlan():state.data.draft}),
  detachRecording: (id: string) => {
    if ([state.data.draft, ...state.data.plans].some(plan =>
      plan.lines.some(line => line.recordingId === id && line.audioAffirmation)
    )) throw Error("This audio is used in a practice. Remove it from the practice and save your changes before deleting.");
    const clean = (p: Plan) => ({
      ...p,
      lines: p.lines.map((l) => {
        if (l.recordingId !== id) return l;
        const { recordingId, recordedText, ...text } = l;
        return text;
      }),
    });
    commit({
      ...state.data,
      draft: clean(state.data.draft),
      plans: state.data.plans.map(clean),
    });
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
