"use client";
import Link from "next/link";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { similarNames } from "@/app/actions/components";
import { recordFile } from "@/app/actions/files";
import { createClient } from "@/lib/supabase/client";

/** Name field that warns when a part with a similar name already exists, so the team doesn't make two. */
export function ComponentNameField({ defaultValue = "", exceptId }: { defaultValue?: string; exceptId?: string }) {
  const [value, setValue] = useState(defaultValue);
  const [found, setFound] = useState<{ q: string; rows: { id: string; name: string; project_name: string }[] }>({ q: "", rows: [] });
  const check = value.trim().length >= 3 && value !== defaultValue;
  useEffect(() => {
    if (!check) return;
    const t = setTimeout(() => { similarNames(value).then((m) => setFound({ q: value, rows: m.filter((x) => x.id !== exceptId) })); }, 300);
    return () => clearTimeout(t);
  }, [value, check, exceptId]);
  // Only show matches for what's in the box now.
  const matches = check && found.q === value ? found.rows : [];
  return (
    <label className="field">
      <span>Name</span>
      <input className="input" name="name" required maxLength={120} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Magnetorquer coil, X axis" autoComplete="off" />
      {matches.length > 0 && (
        <span className="notice notice--warn" role="status">
          Similar parts already exist:{" "}
          {matches.map((m, i) => <span key={m.id}>{i > 0 && ", "}<Link className="link" href={`/components/${m.id}`} target="_blank">{m.name}</Link> ({m.project_name})</span>)}
          . Check it isn&apos;t the same part before you add it.
        </span>
      )}
    </label>
  );
}

const MAX = 50 * 1024 * 1024;

/**
 * Sends one file to storage with progress. The storage library has no progress callback, so this posts to
 * the same storage endpoint it uses, signed in as the person, and the bucket's rules still decide.
 */
function sendFile(path: string, file: File, type: string, token: string, onProgress: (sent: number) => void): Promise<{ error: string | null }> {
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/component-files/${path.split("/").map(encodeURIComponent).join("/")}`;
    xhr.open("POST", url);
    xhr.setRequestHeader("authorization", `Bearer ${token}`);
    xhr.setRequestHeader("apikey", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    xhr.setRequestHeader("content-type", type);
    xhr.setRequestHeader("cache-control", "max-age=3600");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded); };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve({ error: null });
      let message = `Upload failed (${xhr.status})`;
      try { const body = JSON.parse(xhr.responseText); message = body.message ?? body.error ?? message; } catch { /* keep the status */ }
      resolve({ error: xhr.status === 403 || /row-level|unauthorized/i.test(message) ? "Only the owner and editors can upload here" : message });
    };
    xhr.onerror = () => resolve({ error: "The upload stopped. Check the wifi and try again." });
    xhr.send(file);
  });
}

function mb(n: number) {
  return `${(n / 1024 / 1024).toFixed(n < 10 * 1024 * 1024 ? 1 : 0)} MB`;
}

/** Uploads straight from the browser to storage (so big zips don't pass through the server), then records it. */
export function FileUpload({ componentId, revision }: { componentId: string; revision: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rev, setRev] = useState(revision);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ name: string; sent: number; total: number; index: number; count: number } | null>(null);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  // "Uploaded" goes away on its own after a few seconds; errors stay until the next try.
  useEffect(() => {
    if (msg?.kind !== "ok") return;
    const t = setTimeout(() => setMsg(null), 4000);
    return () => clearTimeout(t);
  }, [msg]);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(input.current?.files ?? []);
    if (files.length === 0) { setMsg({ kind: "error", text: "Pick a file first" }); return; }
    setBusy(true); setMsg(null);
    const supabase = createClient();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setBusy(false); setMsg({ kind: "error", text: "You've been signed out. Sign in again, then upload." }); return; }
    let done = 0;
    const errors: string[] = [];
    for (const [index, file] of files.entries()) {
      // Any kind of file. Downloads always come back as attachments, so the type is only a label.
      const type = file.type || "application/octet-stream";
      if (file.size === 0) { errors.push(`${file.name} is empty`); continue; }
      if (file.size > MAX) { errors.push(`${file.name} is over 50 MB. Put it in Google Drive and add a link instead.`); continue; }
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const r = (rev.trim() || "A").replace(/[^\w.\-]+/g, "_").slice(0, 12);
      const path = `${componentId}/${r}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      setProgress({ name: file.name, sent: 0, total: file.size, index, count: files.length });
      const { error } = await sendFile(path, file, type, session.access_token, (sent) => setProgress((p) => (p ? { ...p, sent } : p)));
      if (error) { errors.push(`${file.name}: ${error}`); continue; }
      const res = await recordFile({ component_id: componentId, revision: r, storage_path: path, filename: file.name.slice(0, 200), size_bytes: file.size, content_type: type });
      if (res.error) { errors.push(`${file.name}: ${res.error}`); continue; }
      done++;
    }
    setBusy(false); setProgress(null);
    if (errors.length) setMsg({ kind: "error", text: (done ? `Uploaded ${done}. ` : "") + errors.join(" ") });
    else if (done) setMsg({ kind: "ok", text: done === 1 ? "Uploaded" : `Uploaded ${done} files` });
    if (done) { if (input.current) input.current.value = ""; router.refresh(); }
  }

  const pct = progress && progress.total ? Math.round((progress.sent / progress.total) * 100) : 0;
  return (
    <form onSubmit={upload} className="stack-sm">
      <div className="row">
        <input ref={input} className="input input--inline" type="file" multiple aria-label="Files to upload" style={{ flex: 1 }} />
        <input className="input input--inline" style={{ minWidth: 0, width: 80 }} value={rev} onChange={(e) => setRev(e.target.value)} maxLength={12} aria-label="Revision" title="Revision" />
        <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit" disabled={busy}>{busy ? (progress ? `${pct}%` : "Uploading…") : "Upload"}</button>
      </div>
      {progress && (
        <div className="stack-sm" style={{ gap: 4 }} role="status" aria-live="polite">
          <span className="budget-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={`Uploading ${progress.name}`}><i style={{ width: `${pct}%`, transition: "width .2s" }} /></span>
          <small className="faint">{progress.count > 1 ? `File ${progress.index + 1} of ${progress.count}: ` : ""}{progress.name}, {mb(progress.sent)} of {mb(progress.total)}</small>
        </div>
      )}
      <small className="faint">Any file up to 50 MB: CAD exports, KiCad zips, PDFs, photos, spreadsheets. On an iPhone or iPad, tap Choose Files to pick from the Files app, iCloud Drive or Google Drive.</small>
      {msg && <p className={`notice${msg.kind === "error" ? " notice--error" : ""}`} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</p>}
    </form>
  );
}

/** A comment box that suggests teammates after you type "@", and fills in "@Full Name". */
export function MentionTextarea({ people, name, placeholder, required, maxLength, ariaLabel }: { people: { id: string; name: string }[]; name: string; placeholder?: string; required?: boolean; maxLength?: number; ariaLabel?: string }) {
  const box = useRef<HTMLTextAreaElement>(null);
  const [value, setValue] = useState("");
  const [query, setQuery] = useState<{ at: number; q: string } | null>(null);
  const [pick, setPick] = useState(0);
  // Where the caret goes after a name is filled in, applied right after React updates the box.
  const caretTo = useRef<number | null>(null);
  useLayoutEffect(() => {
    if (caretTo.current == null || !box.current) return;
    box.current.setSelectionRange(caretTo.current, caretTo.current);
    caretTo.current = null;
  });
  // Empty the box once the comment is posted (React resets the form after its action runs).
  useEffect(() => {
    const form = box.current?.form;
    if (!form) return;
    const clear = () => { setValue(""); setQuery(null); };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  const matches = query
    ? people.filter((p) => p.name.toLowerCase().split(/\s+/).some((w) => w.startsWith(query.q.toLowerCase())) || p.name.toLowerCase().startsWith(query.q.toLowerCase())).slice(0, 6)
    : [];

  function track(text: string, caret: number) {
    const before = text.slice(0, caret);
    const at = before.lastIndexOf("@");
    const q = at >= 0 ? before.slice(at + 1) : "";
    const startsWord = at === 0 || (at > 0 && /\s|\(/.test(before[at - 1]));
    setQuery(at >= 0 && startsWord && q.length <= 30 && !/\n|\s{2}/.test(q) ? { at, q } : null);
    setPick(0);
  }

  function choose(p: { name: string }) {
    if (!query || !box.current) return;
    const caret = box.current.selectionStart;
    const next = value.slice(0, query.at) + "@" + p.name + " " + value.slice(caret);
    const pos = query.at + p.name.length + 2;
    caretTo.current = pos;
    setValue(next);
    setQuery(null);
  }

  return (
    <div className="mention">
      <textarea ref={box} className="textarea" name={name} value={value} required={required} maxLength={maxLength} placeholder={placeholder} aria-label={ariaLabel}
        aria-autocomplete="list" aria-controls="mention-list"
        onChange={(e) => { setValue(e.target.value); track(e.target.value, e.target.selectionStart); }}
        onClick={(e) => track(value, e.currentTarget.selectionStart)}
        onBlur={() => setTimeout(() => setQuery(null), 150)}
        onKeyDown={(e) => {
          if (!matches.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setPick((pick + 1) % matches.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setPick((pick - 1 + matches.length) % matches.length); }
          else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); choose(matches[pick]); }
          else if (e.key === "Escape") setQuery(null);
        }} />
      {matches.length > 0 && (
        <ul className="mention__list mc-panel mc-glass" id="mention-list" role="listbox">
          {matches.map((p, i) => (
            <li key={p.id} role="option" aria-selected={i === pick}>
              <button type="button" className={i === pick ? "is-on" : ""} onMouseDown={(e) => { e.preventDefault(); choose(p); }}>{p.name}</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
