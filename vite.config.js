import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The Studio API (npm run dev:api) runs separately; proxy it so the app can call /api.
    proxy: {
      '/api': process.env.API_URL ?? 'http://127.0.0.1:5174',
    },
  },
});
