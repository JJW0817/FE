import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiTarget = env.VITE_API_TARGET ?? 'http://localhost:8080';
  return { base: './', plugins: [react(), tailwindcss()], server: { port: 5173, strictPort: true, proxy: { '/api': { target: apiTarget, changeOrigin: true, headers: { 'ngrok-skip-browser-warning': 'true' }, cookieDomainRewrite: 'localhost' } } } };
});
