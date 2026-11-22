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
        source: "/api/staff/events/:slug/invitations/:invitationId/revoke",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/invitations/:invitationId/revoke`,
      },
      {
        source: "/api/invitations/rsvp",
        destination: new URL("/invitations/rsvp", api).href,
      },
      {
        source: "/api/staff/events/:slug/invitations/preview",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/invitations/preview`,
      },
      {
        source:
          "/api/staff/events/:slug/invitations/:invitationId/replace-pass",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/invitations/:invitationId/replace-pass`,
      },
      {
        source: "/api/staff/events/:slug/invitations/email",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/invitations/email`,
      },
      {
        source: "/api/staff/events/:slug/banner",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/banner`,
      },
      {
        source: "/api/staff/events/:slug",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug`,
      },
      {
        source: "/api/staff/events/:slug/team",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/team`,
      },
      {
        source: "/api/staff/events/:slug/team/:staffId",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/team/:staffId`,
      },
      {
        source: "/api/staff/password/forgot",
        destination: new URL("/staff/password/forgot", api).href,
      },
      {
        source: "/api/staff/password/reset",
        destination: new URL("/staff/password/reset", api).href,
      },
      {
        source: "/api/staff/logout",
        destination: new URL("/staff/logout", api).href,
      },
    ];
  },
};

export default nextConfig;
