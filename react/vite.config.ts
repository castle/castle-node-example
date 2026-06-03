import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Express demo backend (this repo's app.js) runs on port 4006 by default.
// Proxy the API routes to it so the React app can call them with same-origin
// relative paths during development.
const BACKEND = process.env.VITE_BACKEND_URL || 'http://localhost:4006';
const API_ROUTES = [
  '/evaluate_login',
  '/evaluate_new_password',
  '/create_list',
  '/privacy_user_data',
  '/events_schema',
  '/query_events',
];

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: Object.fromEntries(
      API_ROUTES.map((route) => [route, { target: BACKEND, changeOrigin: true }]),
    ),
  },
});
