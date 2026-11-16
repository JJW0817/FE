import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { mkdirSync, writeFileSync } from 'node:fs';
import type { Plugin } from 'vite';
/** 개발용(npm run dev에서만, apply:'serve'): 실제 registration-metadata 응답을 docs/registration-metadata.json 으로 저장한다. 빌드에는 들어가지 않는다 */
const saveRegistrationMetadata = (): Plugin => ({
  name: 'dev-save-registration-metadata', apply: 'serve',
  configureServer(server) {
    server.middlewares.use('/__dev/registration-metadata', (req, res) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      let body = ''; req.on('data', c => { body += c; if (body.length > 5_000_000) req.destroy(); });
      req.on('end', () => {
        try { mkdirSync('docs', { recursive: true }); writeFileSync('docs/registration-metadata.json', JSON.stringify(JSON.parse(body), null, 2)); console.log('registration-metadata 저장됨'); res.statusCode = 204; }
        catch { res.statusCode = 400; }
        res.end();
      });
    });
  },
});
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  // 로컬 개발: /api → Gateway, /pg → PurchaseGateway(/pg는 떼고 전달). 터널(https) 주소도 .env.local에 넣을 수 있다 (docs/tunnel.md)
  const apiTarget = env.VITE_API_TARGET || 'http://localhost:8000';
  const pgTarget = env.VITE_PG_TARGET || 'http://localhost:8001';
  // changeOrigin: 터널이 Host 헤더로 라우팅한다. secure:false: 개발 중 인증서 문제로 막히지 않게. cookieDomainRewrite: 서버 쿠키 Domain을 localhost로
  const proxy = { changeOrigin: true, secure: false, headers: { 'ngrok-skip-browser-warning': 'true' }, cookieDomainRewrite: 'localhost' };
  return { base: './', plugins: [react(), tailwindcss(), saveRegistrationMetadata()], server: { port: 5173, strictPort: true, proxy: {
    '/pg': { ...proxy, target: pgTarget, rewrite: (p: string) => p.replace(/^\/pg/, '') },
    '/api': { ...proxy, target: apiTarget },
  } } };
});
