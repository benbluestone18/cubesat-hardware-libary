import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback", "/auth/confirm", "/privacy", "/terms"];

/** Refreshes the Supabase session on every request and sends signed-out visitors to the sign-in page. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // The page prefetches several tabs at once, and each request can try to refresh the same session.
          // Only the first refresh wins; the others fail with "Refresh Token Not Found" and ask to delete the
          // cookies, which signed people out even though the winner had just saved a fresh session. So the
          // proxy never deletes the session cookies: it only writes new ones. Signing out, which runs in a
          // server action, still deletes them.
          const fresh = cookiesToSet.filter(({ value }) => value !== "");
          if (fresh.length === 0) return;
          fresh.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          fresh.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (!signedIn && !isPublic) {
    const next = path === "/" ? "" : `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    // A form's server action can't follow an ordinary redirect: the page showed "Something broke".
    // This header is how Next.js tells the browser to go to another page after an action.
    if (request.headers.has("next-action")) {
      return new NextResponse(null, { status: 200, headers: { "x-action-redirect": `/login${next};push`, "content-type": "text/plain" } });
    }
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = next;
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|svg|webp)$).*)"],
};
