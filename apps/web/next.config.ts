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
  allowedDevOrigins: ["172.31.1.44"],

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
        source: "/api/staff/events/:slug/team/invite",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/team/invite`,
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
        source: "/api/events/:slug/tickets",
        destination: `${api.replace(/\/$/, "")}/events/:slug/tickets`,
      },
      {
        source: "/api/staff/events/:slug/ticket-allocation",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/ticket-allocation`,
      },
      {
        source: "/api/staff/events/:slug/ticket-tiers",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/ticket-tiers`,
      },
      {
        source: "/api/staff/events/:slug/ticket-tiers/:tierId",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/ticket-tiers/:tierId`,
      },
      {
        source:
          "/api/staff/events/:slug/invitations/:invitationId/resend-paid-pass",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/invitations/:invitationId/resend-paid-pass`,
      },
      {
        source: "/api/staff/events/:slug/payment-reviews",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/payment-reviews`,
      },
      {
        source: "/api/staff/events/:slug/payment-reviews/:kind/:id/provider",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/payment-reviews/:kind/:id/provider`,
      },
      {
        source: "/api/staff/events/:slug/ticket-sales",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/ticket-sales`,
      },
      {
        source: "/api/staff/overview/ticket-sales",
        destination: new URL("/staff/overview/ticket-sales", api).href,
      },
      {
        source:
          "/api/staff/events/:slug/payment-reviews/:kind/:id/resolve-reversed",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/payment-reviews/:kind/:id/resolve-reversed`,
      },
      {
        source: "/api/staff/events/:slug/payment-reviews/resolved",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/payment-reviews/resolved`,
      },
      {
        source: "/api/staff/events/:slug/team/:staffId/resend-setup",
        destination: `${api.replace(/\/$/, "")}/staff/events/:slug/team/:staffId/resend-setup`,
      },

      {
        source: "/api/staff/logout",
        destination: new URL("/staff/logout", api).href,
      },
    ];
  },
};

export default nextConfig;
