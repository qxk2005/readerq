import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8'));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 构建时注入版本号到前端
  env: {
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
  // 允许从外部加载图片
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // 服务端使用 better-sqlite3 需要
  serverExternalPackages: ['better-sqlite3'],
  output: 'standalone',
};
export default nextConfig;

