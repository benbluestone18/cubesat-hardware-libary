"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { back, explain, str } from "./util";

export async function saveTheme(theme: "light" | "dark") {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub;
  if (!uid || (theme !== "light" && theme !== "dark")) return;
  await supabase.from("people").update({ theme }).eq("id", uid);
}

export async function updateMyName(form: FormData) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const uid = data?.claims?.sub as string;
  const name = str(form, "name", 80);
  if (!name) back(`/people/${uid}`, "Enter a name");
  const { error } = await supabase.from("people").update({ name }).eq("id", uid);
  if (error) back(`/people/${uid}`, explain(error));
  revalidatePath("/", "layout");
  back(`/people/${uid}`, "Name saved", "ok");
}

export async function setRole(form: FormData) {
  const supabase = await createClient();
  const id = str(form, "person_id");
  const role = str(form, "role");
  if (role !== "admin" && role !== "member") back("/admin", "Pick a role");
  const { error } = await supabase.from("people").update({ role }).eq("id", id);
  if (error) back("/admin", explain(error));
  revalidatePath("/admin");
  back("/admin", "Role updated", "ok");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
