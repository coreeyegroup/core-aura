import { ReactNode } from "react";

export type Tool =
  | "affirmations" | "studio" | "chakras" | "schedule" | "recordings"
  | "packs" | "sessions" | "display" | "practices";

export function Dashboard({ children }: { children: ReactNode }) {
  return (
    <section className="dashboard" aria-label="Practice dashboard">
      <header className="dashboard-title">
        <h1>Your practice</h1>
        <p>Choose a saved playlist or start a practice.</p>
      </header>
      {children}
    </section>
  );
}
