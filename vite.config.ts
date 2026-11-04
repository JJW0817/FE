import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
const apiTarget = process.env.VITE_API_TARGET ?? 'http://localhost:8080';
export default defineConfig({ base: './', plugins: [react(), tailwindcss()], server: { port: 5173, strictPort: true, proxy: { '/api': { target: apiTarget, changeOrigin: true, headers: { 'ngrok-skip-browser-warning': 'true' }, cookieDomainRewrite: 'localhost' } } } });
