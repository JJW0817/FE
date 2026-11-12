import { describe, expect, it, vi } from 'vitest';
// address.tsx → store.ts가 import 시점에 window·localStorage를 쓴다(node 환경에는 없음)
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, localStorage });
const { addressFormProblems } = await import('./sellerAddresses');

describe('판매자 주소록 입력 검사', () => {
  const ok = { label: '성수 창고', contactName: '김민지', contactPhone: '010-1234-5678', address: { postalCode: '04782', roadAddress: '서울 성동구 성수이로 118', detailAddress: null } };
  it('모두 갖추면 통과(상세 주소는 선택)', () => expect(addressFormProblems(ok)).toEqual({}));
  it('이름·담당자·연락처·주소(우편번호 5자리)', () => {
    expect(Object.keys(addressFormProblems({ label: ' ', contactName: '', contactPhone: 'abc', address: { postalCode: '123', roadAddress: '', detailAddress: null } }))).toEqual(['label', 'contactName', 'contactPhone', 'address']);
    expect(addressFormProblems({ ...ok, label: 'x'.repeat(51) }).label).toContain('50자');
  });
});
