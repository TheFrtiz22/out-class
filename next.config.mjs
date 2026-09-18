/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  distDir: process.env.OUTCLASS_PUBLISH_BUILD ? ".next-publish" : ".next",
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
