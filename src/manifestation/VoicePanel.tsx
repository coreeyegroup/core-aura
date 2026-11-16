import { useEffect, useState, useSyncExternalStore } from "react";
import { speech, Voice } from "./speech";
import { coreVoices } from "./server-voice";
import { manifestationStore as store } from "./store";
import { manifestPlayer } from "./player";
import { PreviewButton } from "./VoiceControls";
import type { Plan } from "./model";
export function VoicePanel() {
  const { data } = useSyncExternalStore(store.subscribe, store.snapshot),
    state = useSyncExternalStore(
      manifestPlayer.subscribe,
      manifestPlayer.snapshot,
    ),
    p = data.draft;
  const [voices, setVoices] = useState<Voice[]>([]),
    [language, setLanguage] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const active = ["playing", "paused"].includes(state.status);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      setBusy(true);
      const [device, core] = await Promise.all([
        speech.voices().catch(() => []),
        coreVoices(),
      ]);
      if (alive) {
        setVoices([...device, ...core]);
        setBusy(false);
      }
    };
    void load();
    if ("speechSynthesis" in window)
      speechSynthesis.addEventListener("voiceschanged", load);
    return () => {
      alive = false;
      if ("speechSynthesis" in window)
        speechSynthesis.removeEventListener("voiceschanged", load);
    };
  }, []);
  function change(patch: Partial<Plan>) {
    try {
      store.draft({ ...p, ...patch });
      setMessage("");
    } catch (e) {
      setMessage((e as Error).message);
    }
  }
  async function refresh() {
    setBusy(true);
    try {
      const [device, core] = await Promise.all([
        speech.voices().catch(() => []),
        coreVoices(true),
      ]);
      setVoices([...device, ...core]);
      setMessage(
        core.length
          ? "Voices refreshed."
          : "Device voices refreshed. Core-aura voices need the updated speech backend and internet.",
      );
    } finally {
      setBusy(false);
    }
  }
  const visible = voices.filter((v) => !language || v.lang === language),
    selected = voices.find((v) => v.voiceURI === p.voice);
  return (
    <section className="voice-panel" aria-label="Voice and playback">
      <h2>Voice &amp; playback</h2>
      {p.mode === "read" && (
        <p className="notice">
          Silent reading is selected.{" "}
          <button disabled={active} onClick={() => change({ mode: "speech" })}>
            Switch to spoken voice
          </button>
        </p>
      )}
      <div className="fields">
        <label>
          Voice language
          <select
            aria-label="Voice language"
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
          >
            <option value="">All languages</option>
            {[...new Set(voices.map((v) => v.lang))].sort().map((lang) => (
              <option key={lang}>{lang}</option>
            ))}
          </select>
        </label>
        <label>
          Voice
          <select
            aria-label="Voice"
            disabled={active}
            value={p.voice}
            onChange={(e) => change({ voice: e.target.value })}
          >
            <option value="">Device default · English</option>
            {p.voice && !visible.some((v) => v.voiceURI === p.voice) && (
              <option value={p.voice}>
                {selected?.name || "Previously selected voice (unavailable)"}
              </option>
            )}
            {visible.map((v, i) => (
              <option key={v.voiceURI + ":" + i} value={v.voiceURI}>
                {v.name} · {v.lang}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="admin-actions">
        <PreviewButton
          label="Test selected voice"
          id="voice-test"
          line={{
            id: "voice-test",
            text: p.lines[0]?.text || "I am ready to begin my practice.",
          }}
        />
        <button disabled={busy || active} onClick={() => void refresh()}>
          {busy ? "Loading voices…" : "Refresh voices"}
        </button>
      </div>
      <p className="content-note">
        {voices.filter((v) => !v.voiceURI.startsWith("core:")).length} device
        voices · {voices.filter((v) => v.voiceURI.startsWith("core:")).length}{" "}
        Core-aura voices. Core-aura voices are synthetic and online; selected
        text goes to your server without being saved.
      </p>
      {!voices.length && !busy && (
        <p role="status">
          No speech voices are available. Refresh voices, install device voice
          data, or update the Core-aura speech backend.
        </p>
      )}
      {p.volume === 0 && (
        <p className="notice">
          Voice volume is zero.{" "}
          <button disabled={active} onClick={() => change({ volume: 0.7 })}>
            Unmute voice
          </button>
        </p>
      )}
      <details>
        <summary>Voice settings &amp; recordings</summary>
        <fieldset disabled={active}>
          <label className="check">
            <input
              type="checkbox"
              checked={!!p.useRecordings}
              onChange={(e) => change({ useRecordings: e.target.checked })}
            />
            Use my recordings when available
          </label>
          <p className="content-note">
            Personal recordings keep their original speed. Other sentences use
            the voice selected above.
          </p>
          <label className="range-label">
            Speech speed <output>{p.rate.toFixed(2)}×</output>
            <input
              type="range"
              aria-label="Speech speed"
              min="0.5"
              max="1.5"
              step="0.05"
              value={p.rate}
              onChange={(e) => change({ rate: Number(e.target.value) })}
            />
          </label>
          <label className="range-label">
            Voice volume <output>{Math.round(p.volume * 100)}%</output>
            <input
              type="range"
              aria-label="Voice volume"
              min="0"
              max="100"
              value={p.volume * 100}
              onChange={(e) => change({ volume: Number(e.target.value) / 100 })}
            />
          </label>
        </fieldset>
        <p className="content-note">
          To add device voices, install voice data in your device’s
          text-to-speech settings, then tap Refresh voices. Also check media
          volume and the selected speaker/headphones.
        </p>
      </details>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
