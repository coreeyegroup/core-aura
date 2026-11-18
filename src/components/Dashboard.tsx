import { ReactNode } from "react";
export type Tool = "affirmations" | "studio" | "chakras" | "schedule" | "recordings" | "packs" | "sessions" | "display" | "practices";
export function Dashboard({ controls }: {
    controls?: ReactNode;
    onTool: (tool: Tool) => void;
    onCategory: (category: string) => void;
    onPractice: (id: string) => void;
    onContinue: () => void;
    onTone: (hz: number) => void;
    sessions: number;
}) {
    return <section className="dashboard" aria-label="Practice dashboard"><div className="dashboard-title"><div><h1>Overview</h1><p className="home-greeting">A little space for your daily practice.</p></div><span>{new Date().toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span></div>{controls}</section>;
}
