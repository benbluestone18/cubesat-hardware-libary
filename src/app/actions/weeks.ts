"use server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { back, explain, optional, str } from "./util";

export async function saveWeek(form: FormData) {
  const supabase = await createClient();
  const week_start = str(form, "week_start", 10);
  const slides = optional(form, "slides_url", 1000);
  const path = `/weeks/${week_start}`;
  if (slides && !/^https:\/\/docs\.google\.com\/presentation\//i.test(slides)) back(path, "Paste the link to the Google Slides deck (docs.google.com/presentation/…)");
  const { error } = await supabase.from("weeks").upsert({ week_start, slides_url: slides, notes: str(form, "notes", 2000), updated_at: new Date().toISOString() });
  if (error) back(path, explain(error));
  revalidatePath("/weeks", "layout");
  back(path, "Saved", "ok");
}
