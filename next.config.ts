import type { NextConfig } from "next";

// Thai, readable URLs (good for sharing and SEO). The pages live at plain
// ASCII routes; these map the Thai paths onto them.
const REPORT = "/แจ้งพบป้าย";

const nextConfig: NextConfig = {
  // Self-contained server for the Docker image (see Dockerfile).
  output: "standalone",
  async redirects() {
    return [{ source: "/report", destination: encodeURI(REPORT), permanent: true }];
  },
  async rewrites() {
    return [
      { source: encodeURI(REPORT), destination: "/report" },
      // /ค้นหา/3ฒน-5702-กรุงเทพมหานคร → search pre-filled and run
      { source: `${encodeURI("/ค้นหา")}/:plate`, destination: "/?plate=:plate" },
      // /จุดพบ/<report id> → the map focused on that report
      { source: `${encodeURI("/จุดพบ")}/:id`, destination: "/?report=:id" },
    ];
  },
};

export default nextConfig;
