import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required when using a custom server
  // Disables the built-in server & allows custom one
  experimental: {
    // Allow socket server to attach to the http server
  },
};

export default nextConfig;
