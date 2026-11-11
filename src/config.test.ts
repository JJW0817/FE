import { afterEach, describe, expect, it, vi } from 'vitest';

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const k of ['VITE_USE_MOCK', 'VITE_MOCK_AUTH', 'VITE_DEMO_LOGIN']) vi.stubEnv(k, env[k] ?? '');
  return import('./config');
}
afterEach(() => vi.unstubAllEnvs());

describe('mock 모드 판단', () => {
  it('아무것도 없으면 실제 API', async () => { const c = await load({}); expect(c.USE_MOCK).toBe(false); expect(c.DEMO_LOGIN).toBe(false); });
  it('VITE_USE_MOCK=true 또는 예전 플래그면 mock', async () => {
    expect((await load({ VITE_USE_MOCK: 'true' })).USE_MOCK).toBe(true);
    expect((await load({ VITE_DEMO_LOGIN: 'true' })).USE_MOCK).toBe(true);
    expect((await load({ VITE_MOCK_AUTH: 'true' })).USE_MOCK).toBe(true);
  });
  it('VITE_USE_MOCK=false를 명시하면 다른 mock 변수보다 우선해 실제 API', async () => {
    const c = await load({ VITE_USE_MOCK: 'false', VITE_DEMO_LOGIN: 'true', VITE_MOCK_AUTH: 'true' });
    expect(c.USE_MOCK).toBe(false); expect(c.DEMO_LOGIN).toBe(false); expect(c.MOCK_AUTH).toBe(false);
  });
});
