import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev only: lets phones and other machines on the local network load the dev
  // server's assets when it runs with -H 0.0.0.0 (Next blocks cross-origin dev
  // requests by default). No effect on production builds.
  allowedDevOrigins: ["192.168.1.*", "localhost"],
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
