import path from "path";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  /** Уменьшает образ Docker: в `.next/standalone` кладётся только нужное для `next start`. */
  output: "standalone",
  webpack: (config) => {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": path.resolve(process.cwd())
    };
    return config;
  },
  /** Старый URL входа: один редирект на `/sign-in` (иначе в проде возможен 307 Location: /login на самом `/login`). */
  async redirects() {
    return [{ source: "/login", destination: "/sign-in", permanent: false }];
  }
};

export default nextConfig;

