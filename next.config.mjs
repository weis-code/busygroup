/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    instrumentationHook: true,
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Prevent webpack from bundling native Node.js packages
      const originalExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
          ? [config.externals]
          : [];

      config.externals = [
        ...originalExternals,
        ({ request }, callback) => {
          const serverOnlyPkgs = ['postgres', 'bcryptjs'];
          if (serverOnlyPkgs.some(p => request === p || request.startsWith(p + '/'))) {
            return callback(null, 'commonjs ' + request);
          }
          callback();
        },
      ];
    }
    return config;
  },
};
export default nextConfig;
