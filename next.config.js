/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // Prevent Privacy Cash SDK from being bundled into browser
    // SDK is Node.js only; browser gets empty stub
    if (!isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]).filter(Boolean),
        function(context, request, callback) {
          // Provide empty stubs for Node.js modules so they don't break browser
          if (request === '@privacy-cash/privacy-cash-sdk' ||
              request === 'node-localstorage' ||
              request === 'pino' ||
              request === 'pino-pretty') {
            // Return as variable assignment (empty object in browser)
            return callback(null, `var {}`)
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
        stream: false,
      }
    }
    return config
  },
}

module.exports = nextConfig



