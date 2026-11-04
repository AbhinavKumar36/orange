/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@orange/api-contracts'],
  experimental: {
    cpus: 1,
  },
};

export default nextConfig;

