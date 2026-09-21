/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  basePath: "/out-class",
  // Keep production checks from overwriting the running development server's files.
  distDir: process.env.OUTCLASS_PUBLISH_BUILD
    ? ".next-publish"
    : process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
}

export default nextConfig
