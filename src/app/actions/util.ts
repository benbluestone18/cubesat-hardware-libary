import "server-only";
import { redirect } from "next/navigation";

export function str(form: FormData, key: string, max = 4000): string {
  const v = form.get(key);
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

export function optional(form: FormData, key: string, max = 4000): string | null {
  const v = str(form, key, max);
  return v === "" ? null : v;
}

/** Send the person back to a page with a plain-language message. */
export function back(path: string, message: string, kind: "error" | "ok" = "error"): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${kind}=${encodeURIComponent(message)}`);
}

/** Turn a database error into words a team member understands. */
export function explain(error: { message: string; code?: string } | null): string {
  if (!error) return "Something went wrong";
  if (error.code === "42501") return "You don't have permission to do that";
  if (error.code === "23505") return "That name is already taken";
  if (error.code === "23514") return "One of the fields isn't valid";
  return error.message.replace(/^.*?:\s*/, "") || "Something went wrong";
}

export function safePath(p: string | null, fallback: string): string {
  return p && p.startsWith("/") && !p.startsWith("//") ? p : fallback;
}
