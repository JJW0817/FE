import { describe, expect, it, vi } from 'vitest';
import { emptyState } from './domain';
import { STORAGE_TAG, USE_MOCK } from './config';

// store.ts는 window·localStorage를 바로 쓰므로 최소한만 흉내 낸 뒤 불러온다
const mem = new Map<string, string>();
vi.stubGlobal('window', { addEventListener: () => {} });
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
const { persisted, restoreLive } = await import('./store');

describe.runIf(!USE_MOCK)('실제 모드 저장소', () => {
  const s = { ...emptyState(), activeUserId: 'u1', products: [{ id: 'p1', images: ['https://old-tunnel.example/img.png'] } as never], orders: [{ id: 'o1' } as never],
    holds: [{ id: 'h1', userId: 'u1', productId: 'p1', lines: [], status: 'reserved' as const, expiresAt: Date.now() + 60_000 }, { id: 'h2', userId: 'u1', productId: 'p1', lines: [], status: 'released' as const, expiresAt: 0 }] };
  it('서버 데이터(상품·주문·끝난 결제 대기)는 저장하지 않고, 서버 주소·버전 꼬리표를 함께 남긴다', () => {
    const out = persisted(s) as Record<string, unknown>;
    expect(out.tag).toBe(STORAGE_TAG); expect(out.products).toBeUndefined(); expect(out.orders).toBeUndefined();
    expect((out.holds as { id: string }[]).map(h => h.id)).toEqual(['h1']); expect(out.activeUserId).toBe('u1');
  });
  it('꼬리표가 다르면(예전 서버 주소·형식) 버린다', () => {
    expect(restoreLive({ ...s, tag: 'https://old-tunnel.example#1' })).toBeNull(); expect(restoreLive(s)).toBeNull();
    const back = restoreLive(JSON.parse(JSON.stringify(persisted(s))));
    expect(back.products).toEqual([]); expect(back.activeUserId).toBe('u1');
  });
});
