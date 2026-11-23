function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing ${name}. Copy .env.example to .env.local and fill it in.`);
  return value;
}

export const env = {
  get supabaseUrl() {
    return required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get supabaseAnonKey() {
    return required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
};

/** The only email domain allowed in. */
export const SCHOOL_DOMAIN = "lgsstudent.org";

/**
 * Google sign-in stays hidden until the school's Google Workspace admin allows the app.
 * Until then the school blocks it, so the button would only lead to an error.
 */
export function googleSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_GOOGLE_SIGNIN === "on";
}

/** Email links are the main way in. They can only be turned off while Google sign-in is on, so the page always has a way to sign in. */
export function emailSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EMAIL_SIGNIN !== "off" || !googleSignInEnabled();
}
