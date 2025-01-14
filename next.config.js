/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/**": [
      "/.next",
      "/public",
      "/app",
      "/lib",
      "/components",
      "/config",
      "/middleware.js",
      "/hooks",
      "/auth",
      "/package.json",
    ],
  },
  api: {
    responseLimit: "10mb",
  },
};

module.exports = nextConfig;
