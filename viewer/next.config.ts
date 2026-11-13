import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: {
    // Compile the stylesheet from source on every build. With the compiler cache that Vercel
    // restores from the previous deployment, a build once shipped the previous theme (the old
    // custom properties from globals.css) together with the new utility classes.
    turbopackFileSystemCacheForBuild: false,
  },
  // Artifact base URLs must end with a slash so that relative references
  // resolve next to the entrypoint. The request proxy adds it where needed.
  skipTrailingSlashRedirect: true,
  images: {
    remotePatterns: [{ protocol: "https", hostname: "avatars.githubusercontent.com" }],
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
