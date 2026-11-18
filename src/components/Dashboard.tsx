import { ReactNode } from "react";

export type Tool =
  | "affirmations" | "studio" | "chakras" | "schedule" | "recordings"
  | "packs" | "sessions" | "display" | "practices";

export function Dashboard({ children }: { children: ReactNode }) {
  return (
    <section className="dashboard" aria-label="Practice dashboard">
      <header className="dashboard-title">
        <h1>Your practice</h1>
        <span>{new Date().toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
        })}</span>
      </header>
      {children}
    </section>
  );
}
