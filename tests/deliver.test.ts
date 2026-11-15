import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({
  native: true,
  files: [] as any[],
  canShare: vi.fn(),
  share: vi.fn(),
  writeFile: vi.fn(),
  deleteFile: vi.fn(),
}));
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => mock.native },
}));
vi.mock("@capacitor/filesystem", () => ({
  Directory: { Cache: "CACHE" },
  Filesystem: {
    readdir: async () => ({ files: mock.files }),
    writeFile: mock.writeFile,
    deleteFile: mock.deleteFile,
  },
}));
vi.mock("@capacitor/share", () => ({
  Share: { canShare: mock.canShare, share: mock.share },
}));
import { deliverFile, cleanupExports } from "../src/files/deliver";
beforeEach(() => {
  vi.clearAllMocks();
  mock.native = true;
  mock.files = [];
  mock.canShare.mockResolvedValue({ value: true });
  mock.writeFile.mockResolvedValue({
    uri: "file:///cache/core-aura-exports/test.wav",
  });
  mock.share.mockResolvedValue({});
  vi.stubGlobal(
    "FileReader",
    class {
      result = "data:audio/wav;base64,dGVzdA==";
      onload?: () => void;
      readAsDataURL() {
        queueMicrotask(() => this.onload?.());
      }
    },
  );
});
afterEach(() => vi.unstubAllGlobals());
describe("native export handoff", () => {
  it("shares a private cache URI and keeps it available for asynchronous receivers", async () => {
    const message = await deliverFile(
      new Blob(["test"]),
      "core-aura-voice.wav",
    );
    expect(mock.writeFile).toHaveBeenCalledWith(
      expect.objectContaining({
        directory: "CACHE",
        recursive: true,
        data: "dGVzdA==",
        path: expect.stringMatching(
          /^core-aura-exports\/[0-9]+-.*-core-aura-voice.wav$/,
        ),
      }),
    );
    expect(mock.share).toHaveBeenCalledWith(
      expect.objectContaining({
        files: ["file:///cache/core-aura-exports/test.wav"],
      }),
    );
    expect(mock.deleteFile).not.toHaveBeenCalled();
    expect(message).not.toMatch(/saved|sent/i);
  });
  it("handles cancel and failures without reporting a successful save", async () => {
    mock.share.mockRejectedValueOnce(Error("Share canceled"));
    expect(await deliverFile(new Blob(["x"]), "voice.wav")).toMatch(
      /cancelled/,
    );
    mock.writeFile.mockRejectedValueOnce(Error("Storage full"));
    await expect(deliverFile(new Blob(["x"]), "voice.wav")).rejects.toThrow(
      "Storage full",
    );
    mock.canShare.mockResolvedValueOnce({ value: false });
    await expect(deliverFile(new Blob(["x"]), "voice.wav")).rejects.toThrow(
      "unavailable",
    );
  });
  it("rejects simultaneous share actions and invalid output names", async () => {
    let finish!: (v: unknown) => void;
    mock.share.mockImplementationOnce(() => new Promise((r) => (finish = r)));
    const pending = deliverFile(new Blob(["x"]), "voice.wav");
    await vi.waitFor(() => expect(mock.share).toHaveBeenCalled());
    await expect(deliverFile(new Blob(["y"]), "voice.wav")).rejects.toThrow(
      "Finish",
    );
    finish({});
    await pending;
    await expect(deliverFile(new Blob(["x"]), "voice.exe")).rejects.toThrow(
      "filename",
    );
  });
  it("cleans only old generated exports from the dedicated cache folder", async () => {
    const old = Date.now() - 90000000;
    mock.files = [
      {
        name: "1700000000000-abc-core-aura-Voice.json",
        type: "file",
        mtime: old,
      },
      { name: "1700000000000-abc-voice.wav", type: "file", mtime: Date.now() },
      { name: "other.json", type: "file", mtime: old },
    ];
    await cleanupExports();
    expect(mock.deleteFile).toHaveBeenCalledTimes(1);
    expect(mock.deleteFile).toHaveBeenCalledWith({
      directory: "CACHE",
      path: "core-aura-exports/1700000000000-abc-core-aura-Voice.json",
    });
  });
});
