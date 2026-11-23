import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // How long the browser keeps pages it already has, so a click needs no trip to the server.
    // static: pages prefetched in full, which are the top-bar and side-rail tabs (see components/nav.tsx).
    //   This is 5 minutes, Next's own default. At 30 seconds every tab re-downloaded at once on the next click,
    //   and that click took 0.55 to 0.7 s, slower than with no caching at all.
    // dynamic: any other page you have opened, kept for 30 seconds for going back and forth.
    // Your own edits clear both at once, because every server action calls revalidatePath.
    // Teammates' edits show up within those times, or straight away on reload.
    staleTimes: { dynamic: 30, static: 300 },
  },
};

export default nextConfig;
