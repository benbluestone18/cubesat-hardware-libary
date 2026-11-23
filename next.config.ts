import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Keep pages you have just seen in the browser for 30 seconds, so switching back to a tab is instant
    // instead of another round trip to the server (Next's default for signed-in, dynamic pages is 0).
    // Anything you change yourself clears this at once: every server action calls revalidatePath.
    // Changes made by teammates show up within 30 seconds, or straight away on reload.
    staleTimes: { dynamic: 30, static: 30 },
  },
};

export default nextConfig;
