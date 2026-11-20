import { useRef, useState } from "react";
import {
  ArrowRight, AudioLines, BookOpen, Flower2, Layers, ListMusic, Mic, Music2,
  Package, Search, Sparkles, Waves, X,
} from "lucide-react";
import type { Route } from "../navigation";

type LibraryRoute = Pick<Route, "libraryView" | "librarySection">;

export const collections = [
  { label: "Sounds", description: "Core sounds, instruments and raw samples", icon: AudioLines, libraryView: "sounds", librarySection: "all" },
  { label: "Backgrounds", description: "Ambient sounds and imported backgrounds", icon: Waves, libraryView: "backgrounds", librarySection: "all" },
  { label: "Voices", description: "Default voices and personal recordings", icon: Mic, libraryView: "manifestation", librarySection: "recordings" },
  { label: "Affirmations", description: "All your affirmations in one list", icon: BookOpen, libraryView: "manifestation", librarySection: "all" },
  { label: "Manifestation practices", description: "Create and manage saved practices", icon: Sparkles, libraryView: "manifestation", librarySection: "saved" },
  { label: "Audio files", description: "Meditation music and classical audio", icon: Music2, libraryView: "audio", librarySection: "all" },
  { label: "Sound packs", description: "Download audio for offline listening", icon: Package, libraryView: "packs", librarySection: "all" },
  { label: "Saved mixes", description: "Layered sounds and chakra sets", icon: Layers, libraryView: "mixes", librarySection: "all" },
  { label: "Chakras", description: "Seven chakra profiles", icon: Flower2, libraryView: "chakras", librarySection: "all" },
  { label: "Playlists", description: "Arrange and play your sessions", icon: ListMusic, libraryView: "overview", librarySection: "playlists" },
] as const satisfies readonly (LibraryRoute & { label: string; description: string; icon: typeof Mic })[];

export function LibraryOverview({ onOpen }: { onOpen: (route: LibraryRoute) => void }) {
  const [query, setQuery] = useState("");
  const search = useRef<HTMLInputElement>(null);
  const term = query.trim().toLowerCase();
  const shown = collections.filter(item => (item.label + " " + item.description).toLowerCase().includes(term));

  return (
    <div className="library-overview">
      <h1>Library</h1>
      <div className="library-search">
        <Search size={19} aria-hidden="true" />
        <input
          ref={search}
          type="search"
          aria-label="Find a collection"
          placeholder="Find a collection"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
        {query && <button className="icon-button" aria-label="Clear library search" onClick={() => {
          setQuery("");
          search.current?.focus();
        }}><X size={18} /></button>}
      </div>
      <section aria-labelledby="library-collections-title">
        <h2 id="library-collections-title">Collections</h2>
        <div className="library-destinations" role="group" aria-label="Library collections">
          {shown.map(({ label, description, icon: Icon, libraryView, librarySection }) => (
            <button
              key={label}
              aria-label={label}
              aria-describedby={"library-description-" + libraryView + "-" + librarySection}
              onClick={() => onOpen({ libraryView, librarySection })}
            >
              <span className="library-tile-icon"><Icon size={19} aria-hidden="true" /></span>
              <span className="library-tile-label">
                <strong>{label}</strong>
                <small id={"library-description-" + libraryView + "-" + librarySection}>{description}</small>
              </span>
              <ArrowRight className="library-tile-arrow" size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
        {!shown.length && <p className="content-note" role="status">No collections match your search.</p>}
      </section>
    </div>
  );
}
