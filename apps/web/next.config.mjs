/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@solarecoheat/validators", "@solarecoheat/db"],
    // Next 16 + next-pwa ainda é instável neste projeto.
    // Mantemos PWA estático com assets versionados em /public (manifest.json e sw.js).
    turbopack: {},
};

export default nextConfig;
