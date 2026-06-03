import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// This app is built and served by the Express demo backend from /react-app on
// the post-login /account page. `base` makes asset URLs resolve under that
// mount, and the fixed output filenames let the Pug shell reference the bundle
// without parsing a manifest.
//
// For standalone React development you can still run `npm run dev` and point a
// browser at http://localhost:5173/react-app/; the API routes are proxied to
// the Express backend below.
const BACKEND = process.env.VITE_BACKEND_URL || 'http://localhost:4006';
const API_ROUTES = ['/evaluate_profile_update', '/evaluate_login'];

export default defineConfig({
  base: '/react-app/',
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'assets/account.js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/account.[ext]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_ROUTES.map((route) => [route, { target: BACKEND, changeOrigin: true }]),
    ),
  },
});
