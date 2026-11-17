import { AndroidRelease, InstalledAndroid, assessAndroidUpdate, fetchAndroidRelease } from "./channel";
export type UpdateProgress = {
    phase: string;
    busy: boolean;
    received: number;
    total: number;
};
export interface AndroidUpdateBridge {
    info(): Promise<InstalledAndroid>;
    updateStatus(): Promise<UpdateProgress>;
    installUpdate(options: {
        release: AndroidRelease;
    }): Promise<{
        status: string;
    }>;
    cancelUpdate(): Promise<void>;
    addListener(event: "updateProgress", listener: (event: UpdateProgress) => void): Promise<{
        remove(): Promise<void>;
    }>;
}
export type UpdateView = {
    installed?: InstalledAndroid;
    busy: boolean;
    phase: string;
    message: string;
    percent: number;
    migration: boolean;
};
const messages: Record<string, string> = {
    error: "The update could not finish. Tap Update latest to retry.",
    downloading: "Downloading the latest update inside Core-aura…",
    verifying: "Verifying the update and app signature…",
    permission: "Allow updates from Core-aura in Android, then return here to continue.",
    installing: "Installing the latest version… The app may close while it updates. Android may request confirmation.",
    confirming: "Confirm Update in Android to finish.",
    "confirmation-required": "Android needs confirmation. Tap Update latest to continue using the verified download.",
    "permission-required": "Update permission was not enabled. Tap Update latest to retry; the verified file is kept.",
    closed: "The installation screen closed. If you cancelled, tap Update latest to retry.",
    installed: "Core-aura was updated. Reopen the app if Android asks you to.",
    cancelled: "Update cancelled. The installed app was kept.",
};
/** A shared controller keeps progress alive while Settings is closed and reopened. */
export class AndroidUpdateController {
    private value: UpdateView = { busy: false, phase: "idle", message: "", percent: 0, migration: false };
    private listeners = new Set<() => void>();
    private ready?: Promise<void>;
    private cancelling = false;
    private running = false;
    constructor(private bridge: AndroidUpdateBridge, private release = fetchAndroidRelease) { }
    snapshot = () => this.value;
    subscribe = (fn: () => void) => { this.listeners.add(fn); return () => { this.listeners.delete(fn); }; };
    private set(patch: Partial<UpdateView>) { this.value = { ...this.value, ...patch }; this.listeners.forEach(fn => fn()); }
    private progress = (event: UpdateProgress) => {
        if (this.running && event.phase === "idle" && !event.busy)
            return;
        const percent = event.total > 0 ? Math.max(0, Math.min(100, Math.floor(event.received / event.total * 100))) : 0;
        this.set({ phase: event.phase, busy: event.busy, percent, ...(messages[event.phase] ? { message: messages[event.phase] } : {}) });
    };
    initialize() {
        if (!this.ready)
            this.ready = (async () => {
                const handle = await this.bridge.addListener("updateProgress", this.progress);
                try {
                    this.progress(await this.bridge.updateStatus());
                    this.set({ installed: await this.bridge.info() });
                }
                catch (error) {
                    await handle.remove();
                    throw error;
                }
            })().catch(error => { this.ready = undefined; this.set({ busy: false, message: error instanceof Error ? error.message : "Android app information is unavailable. Reopen the app and retry." }); });
        return this.ready;
    }
    async update(audioActive: boolean) {
        if (this.value.busy || this.running)
            return;
        if (audioActive) {
            this.set({ message: "Stop all audio before updating the app." });
            return;
        }
        this.cancelling = false;
        this.running = true;
        this.set({ busy: true, phase: "checking", message: "Checking the latest Android version…", percent: 0, migration: false });
        try {
            // Register events without overwriting the in-flight checking state.
            await this.initialize();
            if (this.value.busy && !["checking", "idle"].includes(this.value.phase))
                return;
            if (this.cancelling) {
                this.set({ busy: false, message: messages.cancelled, phase: "cancelled" });
                return;
            }
            this.set({ busy: true, phase: "checking" });
            const installed = await this.bridge.info(), candidate = await this.release();
            this.set({ installed });
            if (this.cancelling) {
                this.set({ busy: false, message: messages.cancelled, phase: "cancelled" });
                return;
            }
            const result = assessAndroidUpdate(installed, candidate);
            if (result === "current") {
                this.set({ busy: false, phase: "current", message: "You have the latest Android app." });
                return;
            }
            if (result === "test-migration") {
                this.set({ busy: false, phase: "migration", migration: true, message: "This old test build uses a different signing key. Export your saved data and install the stable app once. Stable updates keep the same app and its data." });
                return;
            }
            const outcome = await this.bridge.installUpdate({ release: candidate });
            this.set({ busy: false, phase: outcome.status, message: messages[outcome.status] || "The update screen closed. Tap Update latest to retry if needed." });
            this.set({ installed: await this.bridge.info() });
        }
        catch (error) {
            this.set({ busy: false, phase: this.cancelling ? "cancelled" : "error", message: this.cancelling ? messages.cancelled : error instanceof Error ? error.message : "The update failed. Retry after checking your connection and free storage." });
        }
        finally {
            this.running = false;
        }
    }
    async cancel() {
        if (!this.value.busy || ["installing", "confirming"].includes(this.value.phase))
            return;
        this.cancelling = true;
        this.set({ message: "Cancelling the update…" });
        try {
            await this.bridge.cancelUpdate();
        }
        catch {
            this.set({ message: "Could not cancel immediately. Please wait for the current step to finish." });
        }
    }
}
