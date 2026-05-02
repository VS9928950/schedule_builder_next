/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Уменьшает образ Docker: в `.next/standalone` кладётся только нужное для `next start`. */
  output: "standalone"
};

export default nextConfig;

