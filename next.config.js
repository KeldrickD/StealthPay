/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Prevent Privacy Cash SDK from being bundled into browser
    // SDK is Node.js only; will return mock in browser context
    if (!isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        '@privacy-cash/privacy-cash-sdk',
        'node-localstorage',
        'fs',
        'path',
        'crypto',
        'buffer',
      ]
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
        buffer: false,
        net: false,
        tls: false,
      }
    }
    return config
  },
}

module.exports = nextConfig

