import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Downloads go through a one-minute signed link, so files are never public. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: file } = await supabase.from("files").select("storage_path, filename, component_id, deleted_at").eq("id", id).maybeSingle();
  if (!file || file.deleted_at) return new NextResponse("File not found", { status: 404 });
  const { data, error } = await supabase.storage.from("component-files").createSignedUrl(file.storage_path, 60, { download: file.filename });
  if (error || !data) return NextResponse.redirect(new URL(`/components/${file.component_id}?error=${encodeURIComponent("Couldn't open that file")}`, request.nextUrl.origin));
  return NextResponse.redirect(data.signedUrl);
}
