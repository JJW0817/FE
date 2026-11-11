import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 로컬 개발: /api → Gateway, /pg → PurchaseGateway(/pg는 떼고 전달). 터널(https) 주소도 .env.local에 넣을 수 있다 (docs/tunnel.md)
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8000';
  const pgTarget = env.VITE_PG_TARGET || 'http://localhost:8001';
  // changeOrigin: 터널이 Host 헤더로 라우팅한다. secure:false: 개발 중 인증서 문제로 막히지 않게. cookieDomainRewrite: 서버 쿠키 Domain을 localhost로
  const proxy = { changeOrigin: true, secure: false, headers: { 'ngrok-skip-browser-warning': 'true' }, cookieDomainRewrite: 'localhost' };
  return { base: './', plugins: [react(), tailwindcss()], server: { port: 5173, strictPort: true, proxy: {
    '/pg': { ...proxy, target: pgTarget, rewrite: (p: string) => p.replace(/^\/pg/, '') },
    '/api': { ...proxy, target: apiTarget },
  } } };
});
