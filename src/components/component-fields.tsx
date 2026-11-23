import { STATUS_LABEL, STATUS_ORDER } from "@/lib/status";
import type { Library } from "@/lib/data";
import type { Component } from "@/lib/types";
import { ComponentNameField } from "./forms";
import { KeepDraft } from "./client";

/** The fields shared by the new and edit forms. */
export function ComponentFields({ lib, projectId, c, folderId }: { lib: Library; projectId: string; c?: Component; folderId?: string | null }) {
  const folders = lib.folders.filter((f) => f.project_id === projectId);
  const label = (id: string) => lib.folderPath(projectId, id);
  return (
    <>
      <KeepDraft id={c ? `edit-${c.id}` : `new-${projectId}`} />
      <ComponentNameField defaultValue={c?.name} exceptId={c?.id} />
      <label className="field">
        <span>Folder</span>
        <select className="select" name="folder_id" defaultValue={c?.folder_id ?? folderId ?? ""}>
          <option value="">Top of {lib.project.get(projectId)?.name}</option>
          {folders.map((f) => ({ f, l: label(f.id) })).sort((a, b) => a.l.localeCompare(b.l)).map(({ f, l }) => <option key={f.id} value={f.id}>{l}</option>)}
        </select>
      </label>
      <label className="field">
        <span>What it is</span>
        <textarea className="textarea" name="description" maxLength={4000} defaultValue={c?.description} placeholder="What it does, key specs, what it connects to" />
      </label>
      <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
        <label className="field" style={{ flex: 2, minWidth: 180 }}>
          <span>Status</span>
          <select className="select" name="status" defaultValue={c?.status ?? "planned"}>
            {STATUS_ORDER.map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="field" style={{ flex: 1, minWidth: 100 }}>
          <span>Revision</span>
          <input className="input" name="revision" maxLength={12} defaultValue={c?.revision ?? "A"} />
        </label>
      </div>
      <div className="row" style={{ alignItems: "flex-start", gap: 16 }}>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span>Mass (g)</span>
          <input className="input" name="mass_g" type="number" inputMode="decimal" min={0} max={100000} step="any" defaultValue={c?.mass_g ?? ""} placeholder="Optional" />
        </label>
        <label className="field" style={{ flex: 1, minWidth: 140 }}>
          <span>Power draw (W)</span>
          <input className="input" name="power_w" type="number" inputMode="decimal" min={0} max={1000} step="any" defaultValue={c?.power_w ?? ""} placeholder="Optional" />
        </label>
      </div>
      <small className="faint" style={{ marginTop: -8 }}>Both optional. They add up into each team&apos;s budget and the satellite total. Use average power draw, in watts (0.35 for 350 mW).</small>
      <label className="field">
        <span>Onshape link</span>
        <input className="input" name="onshape_url" type="url" maxLength={1000} defaultValue={c?.onshape_url ?? ""} placeholder="https://cad.onshape.com/documents/…" pattern="https://([a-z0-9\-]+\.)*onshape\.com/.*" title="A link on onshape.com" />
        <small>Optional. Onshape docs are private to the school, so teammates need access there too.</small>
      </label>
    </>
  );
}
