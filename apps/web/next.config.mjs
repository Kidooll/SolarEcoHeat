import withPWA from "next-pwa";
import defaultCache from "next-pwa/cache.js";

const runtimeCaching = defaultCache.filter((entry) => {
    return !String(entry.urlPattern).includes("/api/");
});

/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    transpilePackages: ["@solarecoheat/validators", "@solarecoheat/db"],
    pwa: {
        dest: "public",
        disable: process.env.NODE_ENV === "development",
        register: true,
        skipWaiting: true,
        runtimeCaching,
    },
};

export default withPWA(nextConfig);
