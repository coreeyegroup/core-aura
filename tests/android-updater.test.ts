import { afterEach, describe, expect, it, vi } from "vitest";
import { AndroidUpdateBridge, AndroidUpdateController, UpdateProgress } from "../src/android/updater";
import { AndroidRelease, InstalledAndroid } from "../src/android/channel";
const installed: InstalledAndroid = { applicationId: "in.coreeye.coreaura", versionName: "0.22.0", versionCode: 22, sdk: 34, certificateSha256: "b".repeat(64), debug: false };
const release: AndroidRelease = { schemaVersion: 1, applicationId: installed.applicationId, versionName: "0.23.0", versionCode: 23, minSdk: 23, url: "https://core-aura.coreeye.in/android/releases/" + "a".repeat(64) + "/core-aura-0.23.0.apk", sha256: "a".repeat(64), size: 8000000, certificateSha256: installed.certificateSha256, publishedAt: "2026-11-17T10:00:00Z" };
function setup() {
    let event!: (value: UpdateProgress) => void;
    const bridge: AndroidUpdateBridge = { info: vi.fn(async () => installed), updateStatus: vi.fn(async () => ({ phase: "idle", busy: false, received: 0, total: 0 })), addListener: vi.fn(async (_name, callback) => { event = callback; return { remove: vi.fn(async () => { }) }; }), installUpdate: vi.fn(async () => ({ status: "closed" })), cancelUpdate: vi.fn(async () => { }) };
    const fetch = vi.fn(async () => release), controller = new AndroidUpdateController(bridge, fetch);
    return { bridge, fetch, controller, event: (value: UpdateProgress) => event(value) };
}
describe("one-button native updater", () => {
    it("one action checks then invokes the native installer without an external download step", async () => {
        const { controller, bridge } = setup();
        await controller.update(false);
        expect(bridge.installUpdate).toHaveBeenCalledOnce();
        expect(bridge.installUpdate).toHaveBeenCalledWith({ release });
        expect(controller.snapshot()).toMatchObject({ busy: false, phase: "closed" });
    });
    it("never installs for current versions, active audio, or mismatched stable keys", async () => {
        const { controller, bridge, fetch } = setup();
        await controller.update(true);
        expect(fetch).not.toHaveBeenCalled();
        fetch.mockResolvedValue({ ...release, versionCode: 22 });
        await controller.update(false);
        expect(controller.snapshot().message).toMatch(/latest Android app/);
        expect(bridge.installUpdate).not.toHaveBeenCalled();
        fetch.mockResolvedValue({ ...release, certificateSha256: "c".repeat(64) });
        await controller.update(false);
        expect(controller.snapshot().message).toMatch(/signing identity/);
        expect(bridge.installUpdate).not.toHaveBeenCalled();
    });
    it("retains progress across view subscribers and blocks duplicate requests", async () => {
        const { controller, bridge, event } = setup();
        let finish!: (result: {
            status: string;
        }) => void;
        vi.mocked(bridge.installUpdate).mockImplementation(() => new Promise(resolve => finish = resolve));
        await controller.initialize();
        const running = controller.update(false);
        await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
        event({ phase: "downloading", busy: true, received: 4000000, total: 8000000 });
        expect(controller.snapshot()).toMatchObject({ percent: 50, busy: true });
        const unsubscribe = controller.subscribe(() => { });
        unsubscribe();
        expect(controller.snapshot().percent).toBe(50);
        await controller.update(false);
        expect(bridge.installUpdate).toHaveBeenCalledOnce();
        finish({ status: "closed" });
        await running;
        expect(controller.snapshot().busy).toBe(false);
    });
    it("cancels checking before any native download and permits retry", async () => {
        const { controller, fetch, bridge } = setup();
        let finish!: (result: AndroidRelease) => void;
        fetch.mockImplementationOnce(() => new Promise(resolve => finish = resolve));
        const running = controller.update(false);
        await vi.waitFor(() => expect(finish).toBeTypeOf("function"));
        await controller.cancel();
        finish(release);
        await running;
        expect(bridge.installUpdate).not.toHaveBeenCalled();
        expect(controller.snapshot().phase).toBe("cancelled");
        await controller.update(false);
        expect(bridge.installUpdate).toHaveBeenCalledOnce();
    });
    it("reports permission denial and allows the same action to retry", async () => {
        const { controller, bridge } = setup();
        vi.mocked(bridge.installUpdate).mockResolvedValueOnce({ status: "permission-required" });
        await controller.update(false);
        expect(controller.snapshot()).toMatchObject({ busy: false, phase: "permission-required" });
        await controller.update(false);
        expect(bridge.installUpdate).toHaveBeenCalledTimes(2);
    });
});
