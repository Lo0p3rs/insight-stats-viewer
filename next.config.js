/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  ...(process.env.BUILD_DIST_DIR
    ? { distDir: process.env.BUILD_DIST_DIR }
    : {}),
};

module.exports = nextConfig;
