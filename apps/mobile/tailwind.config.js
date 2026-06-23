/** @type {import('tailwindcss').Config} */
module.exports = {
  // NativeWind scans these files for class names at build time.
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        // Mirrors the web app's --background / --foreground tokens.
        background: '#ffffff',
        foreground: '#000000',
      },
    },
  },
  plugins: [],
};
