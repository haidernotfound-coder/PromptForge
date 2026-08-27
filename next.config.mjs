/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "framer-motion"],
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // microphone=(self) and camera=(self) allow mic/camera on our own
          // pages (used by Voice Mode's audio streaming and camera preview)
          // while still blocking both for any embedded third-party origin.
          // camera=() previously blocked the top-level site too, which is
          // why Voice Mode's camera toggle always failed with a silent
          // "not-allowed" (no permission prompt ever shown, and no OS/
          // browser-level allow could override it) -- same root cause the
          // comment above already documents for the microphone fix.
          { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
