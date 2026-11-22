import type { ComponentStatus } from "./status";

export interface Person { id: string; name: string; email: string; avatar_url: string | null; role: "member" | "admin"; theme: "light" | "dark" | null; created_at: string }
export interface Project { id: string; name: string; description: string; status: "active" | "paused" | "done"; created_by: string; created_at: string; deleted_at: string | null }
export interface Folder { id: string; project_id: string; parent_id: string | null; name: string; deleted_at: string | null }
export interface Component {
  id: string; project_id: string; folder_id: string | null; name: string; description: string; owner_id: string;
  status: ComponentStatus; onshape_url: string | null; revision: string; last_update_at: string | null;
  created_at: string; updated_at: string; deleted_at: string | null;
}
export interface Update { id: string; component_id: string; author_id: string; week_start: string; done: string; next: string; blocked: string; created_at: string }
export interface Comment { id: string; component_id: string; author_id: string; body: string; created_at: string; edited_at: string | null }
export interface FileRow { id: string; component_id: string; revision: string; storage_path: string; filename: string; size_bytes: number; content_type: string; uploaded_by: string; created_at: string; deleted_at: string | null }
export interface Week { week_start: string; slides_url: string | null; notes: string }

export interface Membership { person_id: string; project_id: string; lead: boolean }
export interface ComponentLink { id: string; component_id: string; url: string; label: string; added_by: string; created_at: string }
