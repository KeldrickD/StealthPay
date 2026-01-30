/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Prevent Privacy Cash SDK from being bundled into browser
    // SDK is Node.js only; will return mock in browser context
    if (!isServer) {
      // Use a function to handle externals properly, especially for scoped packages
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]).filter(Boolean),
        function(context, request, callback) {
          // Mark Node.js SDK as external (won't be bundled)
          if (request === '@privacy-cash/privacy-cash-sdk' ||
              request === 'node-localstorage' ||
              request === 'fs' ||
              request === 'path' ||
              request === 'crypto' ||
              request === 'buffer') {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        }
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


