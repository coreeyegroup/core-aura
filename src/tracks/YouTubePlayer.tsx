import { useEffect, useRef, useState } from "react";
import { Pause, Play, Square } from "lucide-react";

type Player = { playVideo(): void; pauseVideo(): void; destroy(): void };
type PlayerEvent = { target: Player; data: number };
type PlayerApi = { Player: new (frame: HTMLIFrameElement, options: {
  events: {
    onReady: (event: PlayerEvent) => void;
    onStateChange: (event: PlayerEvent) => void;
    onError: (event: PlayerEvent) => void;
    onAutoplayBlocked: () => void;
  };
}) => Player };
const youtube = window as Window & { YT?: PlayerApi; onYouTubeIframeAPIReady?: () => void };
let loadingApi: Promise<PlayerApi> | undefined;

function loadPlayerApi() {
  if (youtube.YT?.Player) return Promise.resolve(youtube.YT);
  if (!loadingApi) {
    loadingApi = new Promise<PlayerApi>((resolve, reject) => {
      const script = document.createElement("script");
      const previous = youtube.onYouTubeIframeAPIReady;
      const restore = () => {
        clearTimeout(timeout);
        youtube.onYouTubeIframeAPIReady = previous;
      };
      const fail = () => {
        restore();
        script.remove();
        loadingApi = undefined;
        reject(Error("YouTube player controls are unavailable."));
      };
      const timeout = window.setTimeout(fail, 8000);
      youtube.onYouTubeIframeAPIReady = () => {
        if (!youtube.YT?.Player) { fail(); return; }
        restore();
        resolve(youtube.YT);
        previous?.();
      };
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = fail;
      document.head.append(script);
    });
  }
  return loadingApi;
}

export function YouTubePlayer({ id, title, onStop }: { id: string; title: string; onStop: () => void }) {
  const host = useRef<HTMLDivElement>(null);
  const player = useRef<Player | undefined>(undefined);
  const [state, setState] = useState(-1);
  const [ready, setReady] = useState(false);
  const [notice, setNotice] = useState("");
  const [view, setView] = useState<"compact" | "expanded" | "hidden">("compact");
  const playing = state === 1 || state === 3;

  useEffect(() => {
    const container = host.current!;
    const frame = document.createElement("iframe");
    const params = new URLSearchParams({ playsinline: "1", enablejsapi: "1" });
    if (window.location.protocol === "https:" || window.location.protocol === "http:")
      params.set("origin", window.location.origin);
    frame.className = "youtube-player-frame";
    frame.title = "YouTube player for " + title;
    frame.src = "https://www.youtube-nocookie.com/embed/" + id + "?" + params;
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.allow = "autoplay; encrypted-media; picture-in-picture";
    frame.allowFullscreen = true;
    container.append(frame);
    let disposed = false;
    const pauseOnHide = () => { if (document.hidden) player.current?.pauseVideo(); };
    document.addEventListener("visibilitychange", pauseOnHide);
    const observer = new IntersectionObserver(entries => {
      if (!entries[0]?.isIntersecting) player.current?.pauseVideo();
    });
    observer.observe(frame);
    const timeout = window.setTimeout(() => {
      if (!disposed) setNotice("Use Play inside the YouTube player if the external controls are unavailable.");
    }, 12000);
    void loadPlayerApi().then(api => {
      if (disposed) return;
      player.current = new api.Player(frame, { events: {
        onReady: () => { if (!disposed) { clearTimeout(timeout); setNotice(""); setReady(true); } },
        onStateChange: event => {
          if (!disposed) {
            setState(event.data);
            if (event.data === 1) {
              setNotice("");
              if (document.hidden) event.target.pauseVideo();
            }
          }
        },
        onError: () => {
          if (!disposed) {
            clearTimeout(timeout);
            setReady(false);
            setState(-1);
            setNotice("YouTube couldn’t play this video here. Try Open on YouTube.");
          }
        },
        onAutoplayBlocked: () => {
          if (!disposed) setNotice("Press Play inside the YouTube player to start.");
        },
      } });
    }).catch(() => {
      if (!disposed) {
        clearTimeout(timeout);
        setNotice("Use the controls inside the YouTube player.");
      }
    });
    return () => {
      disposed = true;
      clearTimeout(timeout);
      document.removeEventListener("visibilitychange", pauseOnHide);
      observer.disconnect();
      player.current?.destroy();
      player.current = undefined;
      frame.remove();
    };
  }, [id, title]);

  return <>
    <div className="home-actions">
      <button className="primary" type="button" disabled={!ready} onClick={() => {
        if (playing) player.current?.pauseVideo();
        else {
          if (host.current?.hidden) host.current.hidden = false;
          setView(current => current === "hidden" ? "compact" : current);
          host.current?.scrollIntoView({ block: "nearest" });
          player.current?.playVideo();
        }
      }}>{playing ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
        {playing ? "Pause" : state === 2 ? "Resume" : "Play"}</button>
      <button type="button" onClick={onStop}><Square size={16} aria-hidden="true" /> Stop</button>
      <button type="button" onClick={() => setView(view === "expanded" ? "compact" : "expanded")}>
        {view === "expanded" ? "Compact video" : "Open video"}
      </button>
      {(state === 2 || state === 0) && view !== "hidden" &&
        <button type="button" onClick={() => setView("hidden")}>Hide video</button>}
    </div>
    <div ref={host} className={view === "expanded" ? undefined : "youtube-player-compact"}
      hidden={view === "hidden" && !playing} />
    {notice && <p className="content-note" role="status">{notice}</p>}
  </>;
}
