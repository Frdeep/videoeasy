import type { NextConfig } from "next";

// The video editor (apps/editor, OpenCut classic) is a separate Next.js app
// served under /editor on this domain (multi-zones). It shares VideoEasy's
// session cookies; EDITOR_ORIGIN is that app's own deployment URL.
const editor = process.env.EDITOR_ORIGIN?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  async rewrites() {
    if (!editor) return [];
    return [
      { source: "/editor", destination: `${editor}/editor` },
      { source: "/editor/:path+", destination: `${editor}/editor/:path+` },
    ];
  },
};

export default nextConfig;
