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

/** Email links are for local testing, or once the team sets up its own email sender in Supabase. */
export function emailSignInEnabled(): boolean {
  return process.env.NEXT_PUBLIC_EMAIL_SIGNIN === "on";
}
