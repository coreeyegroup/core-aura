import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
export function ConnectionPanel({
  online,
  offlineReady,
}: {
  online: boolean;
  offlineReady: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [result, setResult] = useState<{
      api: string;
      speech: string;
      reminders: string;
    } | null>(null);
  const controller = useRef<AbortController | undefined>(undefined);
  useEffect(() => () => controller.current?.abort(), []);
  async function check() {
    controller.current?.abort();
    if (!online) {
      setResult({
        api: "Offline",
        speech: "Offline — device voices may still work",
        reminders: "Offline",
      });
      setBusy(false);
      return;
    }
    const abort = new AbortController();
    controller.current = abort;
    setBusy(true);
    const timeout = setTimeout(() => abort.abort(), 5000);
    const base = Capacitor.isNativePlatform()
      ? "https://core-aura.coreeye.in"
      : "";
    const load = async (path: string) => {
      const r = await fetch(base + path, {
        signal: abort.signal,
        cache: "no-store",
      });
      if (!r.ok) throw Error();
      return r.json();
    };
    const values = await Promise.allSettled([
      load("/api/health"),
      load("/api/speech/voices"),
      load("/api/manifest-reminders/config"),
    ]);
    clearTimeout(timeout);
    if (controller.current !== abort) return;
    setResult({
      reminders:
        values[2].status === "fulfilled" && values[2].value.ready
          ? "Ready"
          : "Unavailable",
      api:
        values[0].status === "fulfilled" && values[0].value.status === "ok"
          ? "Ready"
          : "Unavailable",
      speech:
        values[1].status === "fulfilled" &&
        values[1].value.ready &&
        values[1].value.voices?.length
          ? "Ready"
          : "Unavailable — try a device voice",
    });
    setBusy(false);
  }
  return (
    <details
      className="connection-panel"
      onToggle={(e) => {
        if (e.currentTarget.open && !result && !busy) void check();
      }}
    >
      <summary>Connection &amp; offline readiness</summary>
      <dl className="service-status">
        <div>
          <dt>Network</dt>
          <dd>{online ? "Available (service checks below)" : "Offline"}</dd>
        </div>
        <div>
          <dt>On-device player</dt>
          <dd>{offlineReady ? "Ready offline" : "Preparing offline assets"}</dd>
        </div>
        <div>
          <dt>Catalog API</dt>
          <dd>{busy ? "Checking…" : result?.api || "Not checked"}</dd>
        </div>
        <div>
          <dt>Web push</dt>
          <dd>{busy ? "Checking…" : result?.reminders || "Not checked"}</dd>
        </div>
        <div>
          <dt>Server voices</dt>
          <dd>{busy ? "Checking…" : result?.speech || "Not checked"}</dd>
        </div>
      </dl>
      <p className="content-note">
        Tones and saved local content do not require the server. Server voices,
        pack downloads and web push need their services and an internet
        connection.
      </p>
      <button disabled={busy} onClick={() => void check()}>
        Check connection
      </button>
    </details>
  );
}
