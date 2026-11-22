"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
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

const MAX = 20 * 1024 * 1024;
const TYPES: Record<string, string> = { zip: "application/zip", pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp" };

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
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const type = TYPES[ext];
      if (!type) { setMsg({ kind: "error", text: `${file.name}: only .zip, .pdf, .png, .jpg and .webp. Zip KiCad projects first.` }); continue; }
      if (file.size > MAX) { setMsg({ kind: "error", text: `${file.name} is over 20 MB` }); continue; }
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
        <input ref={input} className="input input--inline" type="file" multiple accept=".zip,.pdf,.png,.jpg,.jpeg,.webp" aria-label="Files to upload" style={{ flex: 1 }} />
        <input className="input input--inline" style={{ minWidth: 0, width: 80 }} value={rev} onChange={(e) => setRev(e.target.value)} maxLength={12} aria-label="Revision" title="Revision" />
        <button className="mc-btn mc-btn--secondary mc-btn--sm" type="submit" disabled={busy}>{busy ? "Uploading…" : "Upload"}</button>
      </div>
      <small className="faint">KiCad projects as one .zip. PDFs and images too. Up to 20 MB each.</small>
      {msg && <p className={`notice${msg.kind === "error" ? " notice--error" : ""}`} role={msg.kind === "error" ? "alert" : "status"}>{msg.text}</p>}
    </form>
  );
}
