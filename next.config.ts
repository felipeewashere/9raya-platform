import type { NextConfig } from "next";

/**
 * Static export for GitHub Pages (https://<user>.github.io/9raya-platform/).
 * Everything personal is loaded in the browser with supabase-js (RLS), and everything that
 * needs a secret goes through the Supabase Edge Function `api` (supabase/functions/api).
 */
const basePath = process.env.PAGES_BASE_PATH ?? "/9raya-platform";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // exposed to the browser for raw asset URLs (<img>, <video>, Markdown figures, manifest)
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
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
