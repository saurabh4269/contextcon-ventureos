import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  devIndicators: false,
  async redirects() {
    return [{ source: "/", destination: "/today", permanent: false }];
  },
};
export default nextConfig;
