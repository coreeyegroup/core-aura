import { useEffect, useSyncExternalStore } from "react";
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
    useEffect(() => { void updater.initialize(); }, []);
    return <section className="android-updates" aria-label="Android app updates">
    <h3>Android app updates</h3>
    {state.installed && <p className="content-note">Installed: {state.installed.versionName} · build {state.installed.versionCode}{state.installed.debug ? " · test build" : ""}</p>}
    <button className="primary wide" disabled={state.busy} onClick={() => void updater.update(audioActive)}>Update latest</button>
    {state.busy && <>
      <progress aria-label="App update progress" max="100" value={state.percent}/>
      {state.phase === "downloading" && <output>{state.percent}% downloaded</output>}
      {state.phase !== "installing" && state.phase !== "permission" && <button className="wide" onClick={() => void updater.cancel()}>Cancel update</button>}
    </>}
    {state.message && <p role="status" className="content-note">{state.message}</p>}
    {state.migration && <button className="wide" onClick={() => void distribution.openDownload({ url: ANDROID_ORIGIN + "/download.html" })}>Open stable app download</button>}
    <p className="content-note">Updates download inside Core-aura. Android asks you to confirm Update; it may ask once to allow updates from this app.</p>
  </section>;
}
