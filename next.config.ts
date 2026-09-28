import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Netlify's CONTEXT (production, branch-deploy, deploy-preview) exists while
  // the site builds but not inside the server functions at run time, so it is
  // copied into the server code here, at build time. Read by
  // src/lib/site-url.ts (the production guard) and src/lib/ops/format.ts (the
  // alert subject prefix). Not a secret: the value is a deploy context name.
  env: { NETLIFY_BUILD_CONTEXT: process.env.CONTEXT ?? "" },
  // Dev only: lets phones and other machines on the local network load the dev
  // server's assets when it runs with -H 0.0.0.0 (Next blocks cross-origin dev
  // requests by default). No effect on production builds. 127.0.0.1 is a second
  // cookie jar on the same machine: a test account can be signed in there
  // without touching the session on localhost.
  allowedDevOrigins: ["192.168.1.*", "localhost", "127.0.0.1"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
};

export default nextConfig;
