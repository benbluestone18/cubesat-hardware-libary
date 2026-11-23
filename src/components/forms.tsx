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

/** Uploads straight from the browser to storage (so big zips don't pass through the server), then records it. */
export function FileUpload({ componentId, revision }: { componentId: string; revision: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [rev, setRev] = useState(revision);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function upload(e: React.FormEvent) {
    e.preventDefault();
    const files = Array.from(input.current?.files ?? []);
    if (files.length === 0) { setMsg({ kind: "error", text: "Pick a file first" }); return; }
    setBusy(true); setMsg(null);
    const supabase = createClient();
    let done = 0;
    for (const file of files) {
      // Any kind of file. Downloads always come back as attachments, so the type is only a label.
      const type = file.type || "application/octet-stream";
      if (file.size === 0) { setMsg({ kind: "error", text: `${file.name} is empty` }); continue; }
      if (file.size > MAX) { setMsg({ kind: "error", text: `${file.name} is over 50 MB. Put it in Google Drive and add a link instead.` }); continue; }
      const safe = file.name.replace(/[^\w.\-]+/g, "_").slice(-120);
      const r = (rev.trim() || "A").replace(/[^\w.\-]+/g, "_").slice(0, 12);
      const path = `${componentId}/${r}/${crypto.randomUUID().slice(0, 8)}-${safe}`;
      const { error } = await supabase.storage.from("component-files").upload(path, file, { contentType: type, upsert: false });
      if (error) { setMsg({ kind: "error", text: /row-level|unauthorized|403/i.test(error.message) ? "Only the owner and editors can upload here" : `${file.name}: ${error.message}` }); continue; }
      const res = await recordFile({ component_id: componentId, revision: r, storage_path: path, filename: file.name.slice(0, 200), size_bytes: file.size, content_type: type });
      if (res.error) { setMsg({ kind: "error", text: `${file.name}: ${res.error}` }); continue; }
      done++;
    }
    setBusy(false);
    if (done) { setMsg({ kind: "ok", text: done === 1 ? "Uploaded" : `Uploaded ${done} files` }); if (input.current) input.current.value = ""; router.refresh(); }
  }

  return (
    <form onSubmit={upload} className="stack-sm">
      <div className="row">
        <input ref={input} className="input input--inline" type="file" multiple aria-label="Files to upload" style={{ flex: 1 }} />
        <input className="input input--inline" style={{ minWidth: 0, width: 80 }} value={rev} onChange={(e) => setRev(e.target.value)} maxLength={12} aria-label="Revision" title="Revision" />
        <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      </div>
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
