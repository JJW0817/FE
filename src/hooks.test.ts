import { describe, expect, it, vi } from 'vitest';
vi.mock('./store', () => ({ useStore: () => ({}) }));
const { kstShort, kstSlot } = await import('./hooks');
describe('한국 시간 표시', () => {
  it('UTC 01:30 → KST 10:30, 요일 포함', () => {
    const t = Date.parse('2026-11-12T01:30:00Z');
    expect(kstShort(t)).toBe('11.12 10:30');
    expect(kstSlot(t)).toBe('11월 12일 (목) 10:30');
  });
  it('UTC 15:00 → 다음 날 00:00', () => { expect(kstShort(Date.parse('2026-11-02T15:00:00Z'))).toBe('11.3 00:00'); });
});
