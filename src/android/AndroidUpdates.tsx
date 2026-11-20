import { useEffect, useState, useSyncExternalStore } from "react";
import { registerPlugin } from "@capacitor/core";
import { ANDROID_ORIGIN } from "./channel";
import { AndroidUpdateBridge, AndroidUpdateController } from "./updater";
const distribution = registerPlugin<AndroidUpdateBridge & {
    openDownload(options: {
        url: string;
    }): Promise<void>;
}>("AppDistribution");
const updater = new AndroidUpdateController(distribution);
export function AndroidUpdates({ audioActive }: {
    audioActive: boolean;
}) {
    const state = useSyncExternalStore(updater.subscribe, updater.snapshot);
    const [downloadError, setDownloadError] = useState("");
    const recovery = state.migration || ["error", "closed", "confirmation-required", "permission-required"].includes(state.phase);
    useEffect(() => { void updater.initialize(); }, []);
    return <section className="android-updates" aria-label="Android app updates">
    <h3>Android app updates</h3>
    {state.installed && <p className="content-note">Installed: {state.installed.versionName} · build {state.installed.versionCode}{state.installed.debug ? " · test build" : ""}</p>}
    <button className="primary wide" disabled={state.busy} onClick={() => void updater.update(audioActive)}>Update latest</button>
    {state.busy && <>
      <progress aria-label="App update progress" max="100" value={state.percent}/>
      {state.phase === "downloading" && <output>{state.percent}% downloaded</output>}
      {!["installing", "confirming", "permission"].includes(state.phase) && <button className="wide" onClick={() => void updater.cancel()}>Cancel update</button>}
    </>}
    {state.message && <p role="status" className="content-note">{state.message}</p>}
    {recovery && <button className="wide" onClick={() => {
      setDownloadError("");
      void distribution.openDownload({ url: ANDROID_ORIGIN + "/download.html" })
        .catch(() => setDownloadError("Open core-aura.coreeye.in/download.html in your browser to install the official update."));
    }}>{state.migration ? "Open stable app download" : "Open official Android download"}</button>}
    {downloadError && <p role="status" className="content-note">{downloadError}</p>}
    <p className="content-note">Updates download inside Core-aura. Supported Android versions can update directly; Android may ask for confirmation or one-time permission.</p>
  </section>;
}
