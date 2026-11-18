import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Play, Pause, Square, SkipBack, SkipForward, ListMusic, Volume2, AudioLines } from "lucide-react";
import { queuePlayer } from "./runtime";
import { itemDuration } from "./model";
export function QueueTransport() {
    const q = useSyncExternalStore(queuePlayer.subscribe, queuePlayer.snapshot), [expanded, setExpanded] = useState(false), [levels, setLevels] = useState(false), item = q.items[q.index];
    const container = useRef<HTMLElement>(null);
    useEffect(() => { const element = container.current; if (!element)
        return; const observer = new ResizeObserver(() => document.documentElement.style.setProperty("--queue-height", element.getBoundingClientRect().height + "px")); observer.observe(element); return () => { observer.disconnect(); document.documentElement.style.removeProperty("--queue-height"); }; }, [q.status]);
    if (!["playing", "paused", "error"].includes(q.status) || !item)
        return null;
    const duration = itemDuration(item), time = (n: number) => Math.floor(n / 60) + ":" + String(Math.floor(n % 60)).padStart(2, "0");
    return <section ref={container} className="queue-player" aria-label="Playlist player"><div className="queue-player-top"><span className="queue-artwork" aria-hidden="true"><AudioLines size={18}/></span><div><strong>{item.name}</strong><small>{q.name} · {q.index + 1}/{q.items.length} · {q.status}</small></div><span className="queue-time">{time(q.elapsed)} / {time(duration)}</span></div><progress aria-label="Current item progress" max={duration} value={Math.min(q.elapsed, duration)}/><div className="queue-transport"><button className="icon-button" aria-label="Previous item" disabled={q.status === "error" || q.index === 0} onClick={() => void queuePlayer.previous()}><SkipBack size={19}/></button><button className="primary" disabled={q.status === "error"} aria-label={q.status === "playing" ? "Pause playlist" : "Resume playlist"} onClick={() => q.status === "playing" ? queuePlayer.pause() : void queuePlayer.resume()}>{q.status === "playing" ? <Pause size={20}/> : <Play size={20}/>} <span className="queue-toggle-text">{q.status === "playing" ? "Pause" : "Resume"}</span></button><button className="icon-button" aria-label="Next item" disabled={q.status === "error"} onClick={() => void queuePlayer.next()}><SkipForward size={19}/></button><button className="icon-button" aria-label="Stop playlist" onClick={() => queuePlayer.stop()}><Square size={18}/></button><button className="icon-button" aria-label="Show playback queue" aria-expanded={expanded} onClick={() => { setExpanded(!expanded); setLevels(false); }}><ListMusic size={19}/></button><button className="icon-button" aria-label="Playback volume" aria-expanded={levels} onClick={() => { setLevels(!levels); setExpanded(false); }}><Volume2 size={19}/></button></div>
 {levels && <label className="range-label">Sound output <output>{Math.round(q.output * 100)}%</output><input aria-label="Playlist sound output" type="range" min="0" max="100" value={q.output * 100} onChange={e => queuePlayer.setOutput(Number(e.target.value) / 100)}/><small>Voice uses the saved practice level.</small></label>}
 {expanded && <ol className="queue-items">{q.items.map((v, i) => <li aria-current={i === q.index ? "step" : undefined} key={i}>{v.name}<small>{v.kind === "practice" ? "Manifestation" : v.session.kind === "chakras" ? "Chakra" : "Sound"}</small></li>)}</ol>}
 {q.error && <p role="alert">{q.error}</p>}
 </section>;
}
