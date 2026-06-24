/** @type {import('next').NextConfig} */
const nextConfig = {
  // 允许从外部加载图片
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**' },
    ],
  },
  // 服务端使用 better-sqlite3 需要
  serverExternalPackages: ['better-sqlite3'],
};
export default nextConfig;
