/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep production checks from overwriting the running development server's files.
  distDir: process.env.OUTCLASS_PUBLISH_BUILD
    ? ".next-publish"
    : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
