/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  serverExternalPackages: ['postgres', 'node-cron', 'bcryptjs', 'better-sqlite3', 'imapflow', 'mailparser'],
};
export default nextConfig;
