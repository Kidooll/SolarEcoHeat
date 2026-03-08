/** @type {import('tailwindcss').Config} */
const sharedConfig = require("../../tailwind.config.js");

module.exports = {
    ...sharedConfig,
    content: [
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    ],
};
