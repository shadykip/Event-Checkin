import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  reactCompiler: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    const api = process.env.API_BASE_URL;
    if (!api) throw new Error("Set API_BASE_URL in apps/web/.env.local");

    return [
      {
        source: "/api/staff/login",
        destination: new URL("/staff/login", api).href,
      },
      {
        source: "/api/staff/events",
        destination: new URL("/staff/events", api).href,
      },
      {
        source: "/api/staff/events/:slug/check-ins",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/check-ins`,
      },
      {
        source: "/api/staff/events/:slug/attendance",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/attendance`,
      },
      {
        source: "/api/staff/events/:slug/invitations",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/invitations`,
      },
      {
        source: "/api/staff/logout",
        destination: new URL("/staff/logout", api).href,
      },
    ];
  },
};

export default nextConfig;
