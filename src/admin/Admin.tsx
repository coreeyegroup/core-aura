import {
  FormEvent,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Capacitor } from "@capacitor/core";
import { AdminApi, ManagedPack, PackEvent } from "./api";
import { engine } from "../audio/engine";
import { megabytes, PackAsset, SoundPack } from "../packs/catalog";
const blank = (): SoundPack => ({
  id: "",
  title: "",
  description: "",
  tradition: "Original synthesis",
  creator: "",
  license: "",
  attribution: "",
  provenance: "",
  version: "1.0.0",
  minimum_engine: "2.0",
  assets: [],
});
export function Admin() {
  const [key, setKey] = useState(""),
    [operator, setOperator] = useState(""),
    [api, setApi] = useState<AdminApi | null>(null);
  const [identity,setIdentity]=useState<{name:string;role:string;verified:boolean}|null>(null);
  const [rows, setRows] = useState<ManagedPack[]>([]),
    [uploads, setUploads] = useState<PackAsset[]>([]),
    [events, setEvents] = useState<PackEvent[]>([]);
  const [draft, setDraft] = useState<SoundPack>(blank),
    [editing, setEditing] = useState<ManagedPack | null>(null),
    [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [file, setFile] = useState<File | null>(null),
    [assetId, setAssetId] = useState(""),
    [assetTitle, setAssetTitle] = useState("");
  const [notes, setNotes] = useState(""),
    [previewing, setPreviewing] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null),
    active = useRef(true),
    fileInput = useRef<HTMLInputElement>(null);
  const selectionEpoch = useRef(0);
  const states = useSyncExternalStore(engine.subscribe, engine.snapshot);
  useEffect(() => {
    active.current = true;
    engine.stopAll();
    return () => {
      active.current = false;
      abort.current?.abort();
      engine.stopAll();
    };
  }, []);
  const loading = busy || uploadProgress !== null;
  async function refresh(client = api) {
    if (!client) return;
    const [packs, assets, identity] = await Promise.all([
      client.request<{ packs: ManagedPack[] }>("packs"),
      client.request<{ assets: PackAsset[] }>("assets"),
      client.request<{name:string;role:string;verified:boolean}>("me"),
    ]);
    if (active.current) {
      setIdentity(identity);
      setRows(packs.packs);
      setUploads(assets.assets);
    }
  }
  async function connect(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    const client = new AdminApi(key, operator);
    try {
      await refresh(client);
      if (active.current) {
        setApi(client);
        setKey("");
        setMessage("Connected. Access is held in this tab only.");
      }
    } catch (e) {
      if (active.current) setMessage((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function signOut() {
    selectionEpoch.current++;
    abort.current?.abort();
    engine.stopAll();
    setApi(null);
    setKey("");
    setRows([]);
    setUploads([]);
    setEvents([]);
    setDraft(blank());
    setEditing(null);
    setDirty(false);
    setNotes("");
    setFile(null);
    setMessage("Signed out.");
  }
  function change(name: keyof SoundPack, value: unknown) {
    setDraft((p) => ({ ...p, [name]: value }));
    setDirty(true);
  }
  async function select(row?: ManagedPack) {
    if (dirty && !confirm("Discard unsaved pack changes?")) return;
    const epoch = ++selectionEpoch.current;
    setEditing(row || null);
    setDraft(
      row ? { ...row, assets: row.assets.map((a) => ({ ...a })) } : blank(),
    );
    setDirty(false);
    setMessage("");
    setNotes("");
    setEvents([]);
    if (row && api)
      try {
        const result = await api.request<{ events: PackEvent[] }>(
          "packs/" + row.id + "/events",
        );
        if (active.current && epoch === selectionEpoch.current)
          setEvents(result.events);
      } catch (e) {
        if (active.current) setMessage((e as Error).message);
      }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!api) return;
    selectionEpoch.current++;
    setBusy(true);
    setMessage("");
    try {
      const { id, ...data } = draft;
      const saved = await api.request<ManagedPack>(
        "packs/" + id,
        editing ? "PUT" : "POST",
        editing ? { ...data, expected_revision: editing.revision } : data,
      );
      await refresh();
      if (active.current) {
        setEditing(saved);
        setDraft(saved);
        setDirty(false);
        setMessage("Draft saved. Review before publishing.");
        const history = await api.request<{ events: PackEvent[] }>(
          "packs/" + saved.id + "/events",
        );
        if (active.current) setEvents(history.events);
      }
    } catch (e) {
      if (active.current) setMessage((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  async function review(status: ManagedPack["status"]) {
    if (!api || !editing || dirty) return;
    if (!notes.trim()) {
      setMessage("Enter review notes before changing publication status.");
      return;
    }
    selectionEpoch.current++;
    setBusy(true);
    setMessage("");
    try {
      const saved = await api.request<ManagedPack>(
        "packs/" + editing.id + "/review",
        "PATCH",
        {
          status,
          reviewer: operator,
          notes,
          expected_revision: editing.revision,
        },
      );
      await refresh();
      if (active.current) {
        setEditing(saved);
        setDraft(saved);
        setNotes("");
        setMessage("Pack status: " + saved.status + ".");
        const history = await api.request<{ events: PackEvent[] }>(
          "packs/" + saved.id + "/events",
        );
        if (active.current) setEvents(history.events);
      }
    } catch (e) {
      if (active.current) setMessage((e as Error).message);
    } finally {
      if (active.current) setBusy(false);
    }
  }
  function attach(asset: PackAsset) {
    if (draft.assets.length >= 20) {
      setMessage("A pack supports up to 20 files.");
      return false;
    }
    if (draft.assets.some((a) => a.id === asset.id)) {
      setMessage(
        "That audio identifier is already attached. Change its identifier before adding another file.",
      );
      return false;
    }
    change("assets", [...draft.assets, { ...asset }]);
    return true;
  }
  async function upload() {
    if (!api || !file || !assetId || !assetTitle) return;
    if (file.size > 25 * 1024 * 1024) {
      setMessage("Choose a file under 25 MB.");
      return;
    }
    if (draft.assets.some((a) => a.id === assetId)) {
      setMessage("Change the upload identifier: it is already attached.");
      return;
    }
    setMessage("");
    setUploadProgress(0);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const asset = await api.upload(
        file,
        assetId,
        assetTitle,
        controller.signal,
        (value) => {
          if (active.current) setUploadProgress(value);
        },
      );
      if (active.current) {
        const attached = attach(asset);
        setFile(null);
        setAssetId("");
        setAssetTitle("");
        if (fileInput.current) fileInput.current.value = "";
        if (attached)
          setMessage(
            "Audio uploaded and attached. Save the draft to keep this attachment.",
          );
      }
      await refresh();
    } catch (e) {
      if (active.current) setMessage((e as Error).message);
    } finally {
      abort.current = null;
      if (active.current) setUploadProgress(null);
    }
  }
  async function preview(asset: PackAsset) {
    if (!api) return;
    setPreviewing(asset.sha256);
    setMessage("");
    try {
      await engine.toggleRecording("review:" + asset.sha256, () =>
        api.audio(asset.sha256),
      );
    } catch {
      if (active.current)
        setMessage(
          "Audio preview could not start. Check the file and backend connection.",
        );
    } finally {
      if (active.current) setPreviewing(null);
    }
  }
  if (Capacitor.isNativePlatform())
    return (
      <section>
        <h1>Content administration</h1>
        <p>
          Manage content from the{" "}
          <a href="https://core-aura.coreeye.in/#admin">Core-aura website</a>.
        </p>
      </section>
    );
  return (
    <section className="admin-panel" aria-label="Content administration">
      <div className="section-heading">
        <h1>Content administration</h1>
        {api && (
          <button onClick={signOut} disabled={busy}>
            Sign out
          </button>
        )}
      </div>
      {message && (
        <p role="status" className="notice admin-notice">
          {message}
        </p>
      )}
      {!api ? (
        <form onSubmit={connect} className="admin-form">
          <p className="content-note">
            Connect with the administrator access key from your server
            configuration. The key is kept in tab memory, not saved in browser
            storage.
          </p>
          <label>
            Operator name
            <input
              value={operator}
              required
              maxLength={200}
              onChange={(e) => setOperator(e.target.value)}
            />
          </label>
          <label>
            Administrator access key
            <input
              type="password"
              autoComplete="off"
              value={key}
              required
              onChange={(e) => setKey(e.target.value)}
            />
          </label>
          <button className="primary" disabled={busy}>
            Connect
          </button>
        </form>
      ) : (
        <>
          <p className="content-note">
            Identity: {identity?.verified?identity.name:operator} · {identity?.role}. {identity?.verified?"Identity and permissions are verified by the server.":"Legacy shared-key access. Configure named accounts for independent editor/reviewer identities."}
          </p>
          <div className="admin-actions">
            <button disabled={loading||identity?.role==="reviewer"} onClick={() => select()}>
              New pack
            </button>
            <button
              disabled={loading}
              onClick={() => refresh().catch((e) => setMessage(e.message))}
            >
              Refresh list
            </button>
          </div>
          <div className="admin-pack-list" aria-label="Server packs">
            {rows.length ? (
              rows.map((row) => (
                <button
                  key={row.id}
                  disabled={loading}
                  aria-pressed={editing?.id === row.id}
                  onClick={() => select(row)}
                >
                  <strong>{row.title}</strong>
                  <small>
                    {row.status} · v{row.version} · revision {row.revision}
                  </small>
                </button>
              ))
            ) : (
              <p>No server packs yet. Create a draft below.</p>
            )}
          </div>
          <form className="admin-form" onSubmit={save}>
            <h2>{editing ? "Edit pack" : "New pack"}</h2>
            {editing && (
              <p className="content-note">
                Increase the content version when saving changes. Saving returns
                the pack to draft.
              </p>
            )}
            <fieldset disabled={loading} className="admin-fields">
              <legend>Pack details</legend>
              <label>
                Pack identifier
                <input
                  required
                  pattern={"[a-z0-9][a-z0-9\\-]{0,79}"}
                  maxLength={80}
                  readOnly={Boolean(editing)}
                  value={draft.id}
                  onChange={(e) => change("id", e.target.value)}
                />
              </label>
              <label>
                Pack title
                <input
                  required
                  maxLength={120}
                  value={draft.title}
                  onChange={(e) => change("title", e.target.value)}
                />
              </label>
              <label>
                Description
                <textarea
                  required
                  maxLength={2000}
                  value={draft.description}
                  onChange={(e) => change("description", e.target.value)}
                />
              </label>
              <div className="fields">
                <label>
                  Content version
                  <input
                    required
                    pattern="[0-9]+\.[0-9]+\.[0-9]+"
                    value={draft.version}
                    onChange={(e) => change("version", e.target.value)}
                  />
                </label>
                <label>
                  Minimum engine
                  <input
                    required
                    pattern="[0-9]+\.[0-9]+"
                    value={draft.minimum_engine}
                    onChange={(e) => change("minimum_engine", e.target.value)}
                  />
                </label>
              </div>
            </fieldset>
            <fieldset disabled={loading} className="admin-fields">
              <legend>Credits &amp; rights</legend>
              {(
                [
                  ["tradition", "Tradition or origin", 120],
                  ["creator", "Creator", 200],
                  ["license", "License or permission", 300],
                  ["attribution", "Attribution", 1000],
                  ["provenance", "Source and review context", 1000],
                ] as const
              ).map(([name, label, max]) => (
                <label key={name}>
                  {label}
                  <textarea
                    required
                    maxLength={max}
                    value={draft[name]}
                    onChange={(e) => change(name, e.target.value)}
                  />
                </label>
              ))}
            </fieldset>
            <fieldset disabled={loading} className="admin-fields">
              <legend>Attached audio ({draft.assets.length}/20)</legend>
              {!draft.assets.length && (
                <p className="content-note">
                  Upload audio or attach a previous upload below. Audio is
                  required before review.
                </p>
              )}
              {draft.assets.map((asset, i) => (
                <article className="admin-asset" key={asset.sha256 + ":" + i}>
                  <label>
                    Audio identifier
                    <input
                      required
                      pattern={"[a-z0-9][a-z0-9\\-]{0,79}"}
                      value={asset.id}
                      onChange={(e) =>
                        change(
                          "assets",
                          draft.assets.map((a, n) =>
                            n === i ? { ...a, id: e.target.value } : a,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    Audio title
                    <input
                      required
                      maxLength={120}
                      value={asset.title}
                      onChange={(e) =>
                        change(
                          "assets",
                          draft.assets.map((a, n) =>
                            n === i ? { ...a, title: e.target.value } : a,
                          ),
                        )
                      }
                    />
                  </label>
                  <p className="content-note">
                    {asset.seconds.toFixed(1)} sec · {megabytes(asset.bytes)}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      change(
                        "assets",
                        draft.assets.filter((_, n) => n !== i),
                      )
                    }
                  >
                    Detach audio
                  </button>
                </article>
              ))}
            </fieldset>
            <button className="primary" disabled={loading||identity?.role==="reviewer"}>
              {editing ? "Save new version" : "Save draft"}
            </button>
          </form>
          <section className="admin-form" aria-label="Upload audio">
            <h2>Upload audio</h2>
            <p className="content-note">
              16-bit PCM WAV, mono/stereo, 44.1/48 kHz, under 25 MB. Metadata
              chunks are removed; audio samples are preserved. Uploads remain
              private until published.
            </p>
            <label>
              Audio file
              <input
                ref={fileInput}
                type="file"
                accept=".wav,audio/wav"
                disabled={loading}
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setFile(f);
                  if (f) {
                    setAssetTitle(f.name.replace(/\.wav$/i, ""));
                    setAssetId(
                      f.name
                        .replace(/\.wav$/i, "")
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-")
                        .replace(/^-+|-+$/g, "")
                        .slice(0, 80) || "audio",
                    );
                  }
                }}
              />
            </label>
            <label>
              Upload identifier
              <input
                maxLength={80}
                value={assetId}
                disabled={loading}
                onChange={(e) => setAssetId(e.target.value)}
              />
            </label>
            <label>
              Upload title
              <input
                maxLength={120}
                value={assetTitle}
                disabled={loading}
                onChange={(e) => setAssetTitle(e.target.value)}
              />
            </label>
            <button
              disabled={loading || !file || !assetId || !assetTitle || identity?.role==="reviewer"}
              onClick={upload}
            >
              Upload and attach
            </button>
            {uploadProgress !== null && (
              <>
                <label>
                  Uploading {uploadProgress}%
                  <progress
                    aria-label="Audio upload progress"
                    max="100"
                    value={uploadProgress}
                  />
                </label>
                <button onClick={() => abort.current?.abort()}>
                  Cancel upload
                </button>
              </>
            )}
          </section>
          <details className="info-panel">
            <summary>Available uploads ({uploads.length})</summary>
            {uploads.map((asset) => {
              const state = states.find(
                (s) => s.id === "review:" + asset.sha256,
              );
              return (
                <article
                  className="pack-track admin-preview"
                  key={asset.sha256}
                >
                  <span>
                    <strong>{asset.title}</strong>
                    <small>
                      {asset.seconds.toFixed(1)} sec · {megabytes(asset.bytes)}
                    </small>
                  </span>
                  <button
                    disabled={previewing !== null}
                    onClick={() => preview(asset)}
                    aria-label={
                      (state?.status === "playing"
                        ? "Pause preview "
                        : state
                          ? "Resume preview "
                          : "Preview ") + asset.title
                    }
                  >
                    {state?.status === "playing"
                      ? "Pause"
                      : state
                        ? "Resume"
                        : "Preview"}
                  </button>
                  <button
                    disabled={!state}
                    aria-label={"Stop preview " + asset.title}
                    onClick={() => engine.stop("review:" + asset.sha256)}
                  >
                    Stop
                  </button>
                  <button disabled={loading} onClick={() => attach(asset)}>
                    Attach
                  </button>
                </article>
              );
            })}
          </details>
          {editing && (
            <section className="admin-form" aria-label="Publication review">
              <h2>Review &amp; publication</h2>
              <p>
                Status: <strong>{editing.status}</strong> · revision{" "}
                {editing.revision}
              </p>
              {dirty && (
                <p className="content-note">
                  Save the new version before changing publication status.
                </p>
              )}
              <label>
                Review notes
                <textarea
                  value={notes}
                  maxLength={1000}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={loading}
                />
              </label>
              <div className="admin-actions">
                {["draft", "withdrawn"].includes(editing.status) && (
                  <button
                    disabled={loading || dirty || identity?.role==="editor"}
                    onClick={() => review("reviewed")}
                  >
                    Mark reviewed
                  </button>
                )}
                {editing.status === "reviewed" && (
                  <button
                    className="primary"
                    disabled={loading || dirty || identity?.role!=="administrator"}
                    onClick={() => review("published")}
                  >
                    Publish pack
                  </button>
                )}
                {["reviewed", "published"].includes(editing.status) && (
                  <button
                    disabled={loading || dirty || identity?.role!=="administrator"}
                    onClick={() => review("withdrawn")}
                  >
                    Withdraw pack
                  </button>
                )}
              </div>
              <details>
                <summary>Revision history ({events.length})</summary>
                {events.map((row) => (
                  <article className="audit-event" key={row.id}>
                    <strong>
                      {row.action} · revision {row.revision}
                    </strong>
                    <p>
                      {row.actor} · {new Date(row.created_at).toLocaleString()}
                    </p>
                    <details>
                      <summary>Event details</summary>
                      <pre>{JSON.stringify(row.details, null, 2)}</pre>
                    </details>
                  </article>
                ))}
              </details>
            </section>
          )}
        </>
      )}
    </section>
  );
}
