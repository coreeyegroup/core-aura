import type { PracticeState } from "./player";
import { newPlan, Plan } from "./model";
export function isPreview(state: Pick<PracticeState, "plan">) {
  return !!state.plan?.id.startsWith("preview-");
}
export function practiceActive(state: Pick<PracticeState, "status" | "plan">) {
  return !isPreview(state) && ["playing", "paused"].includes(state.status);
}
function content(plan: Plan) {
  const { id, ...value } = plan;
  return JSON.stringify({ ...value, useRecordings: !!value.useRecordings });
}
export function draftChanged(draft: Plan, saved: Plan[]) {
  return (
    content(draft) !==
    content(saved.find((p) => p.id === draft.id) || newPlan())
  );
}
export function confirmDraftReplacement(draft: Plan, saved: Plan[]) {
  return (
    !draftChanged(draft, saved) ||
    window.confirm(
      "Replace your unsaved practice edits? Save the current practice first if you want to keep them.",
    )
  );
}
