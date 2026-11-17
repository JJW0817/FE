import { beforeEach, describe, expect, it, vi } from 'vitest';
const mem = (): Storage => { const m = new Map<string, string>(); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => void m.set(k, String(v)), removeItem: k => void m.delete(k), clear: () => m.clear(), key: () => null, get length() { return m.size; } }; };
vi.stubGlobal('localStorage', mem()); vi.stubGlobal('sessionStorage', mem());
const { ApiError } = await import('./client');
const { CONFIRM_POLL_MS, orderIdOfToss, processTossSuccess, readTossParams, sentRecord, tossFailure, tossOrderIdOf, tossReturnUrls } = await import('./tossReturn');
import type { OrderCommandDto } from './types';

const cmd = (o: Partial<OrderCommandDto> = {}) => ({ orderId: 'o1', state: 'HELD', totalAmount: 21000, failureCode: null, termsVersion: 'v1', ...o }) as OrderCommandDto;
const deps = (states: Partial<OrderCommandDto>[]) => {
  let i = 0; const getCheckout = vi.fn(async (_id: string) => cmd(states[Math.min(i++, states.length - 1)]));
  const requestPayment = vi.fn(async (_id: string, _b: { paymentKey: string; termsVersion: string; requestKey?: string }) => cmd({ state: 'VERIFYING_PAYMENT' }));
  return { getCheckout, requestPayment, getTermsVersion: async () => 'v1', schedule: [0, 0, 0, 0], sleep: async () => {} };
};
const params = { paymentKey: 'pk_1', orderId: 'o1', amount: 21000, code: null, message: null };
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });

describe('돌아오는 주소와 쿼리 읽기', () => {
  it('successUrl·failUrl은 해시 경로', () => {
    expect(tossReturnUrls('https://a.app', '/')).toEqual({ successUrl: 'https://a.app/#/payments/toss/success', failUrl: 'https://a.app/#/payments/toss/fail' });
  });
  it('토스가 해시 앞에 붙인 쿼리(location.search)를 읽는다', () => {
    expect(readTossParams({ search: '?paymentKey=pk&orderId=o1&amount=21000', hash: '#/payments/toss/success' })).toMatchObject({ paymentKey: 'pk', orderId: 'o1', amount: 21000 });
  });
  it('해시 안 쿼리(#/path?…)도 읽고, 실패면 code·message', () => {
    expect(readTossParams({ search: '', hash: '#/payments/toss/success?paymentKey=pk2&orderId=o2&amount=5000' })).toMatchObject({ paymentKey: 'pk2', orderId: 'o2', amount: 5000 });
    expect(readTossParams({ search: '', hash: '#/payments/toss/fail?code=PAY_PROCESS_CANCELED&message=' + encodeURIComponent('취소') + '&orderId=o1' })).toMatchObject({ code: 'PAY_PROCESS_CANCELED', message: '취소', paymentKey: null });
  });
  it('금액이 숫자가 아니면 null', () => { expect(readTossParams({ search: '?amount=1e3', hash: '' }).amount).toBeNull(); });
});

describe('토스 orderId 규칙', () => {
  it('결제창 orderId는 서버 승인 요청과 같은 "SD-" + 주문 id, 서버가 tossOrderId를 주면 그 값', () => {
    expect(tossOrderIdOf('720ec20e-9503-4a86-b1e2-282d88d8f0c7')).toBe('SD-720ec20e-9503-4a86-b1e2-282d88d8f0c7');
    expect(tossOrderIdOf('o1', 'X-o1')).toBe('X-o1'); expect(tossOrderIdOf('o1', null)).toBe('SD-o1');
    expect(tossOrderIdOf('720ec20e-9503-4a86-b1e2-282d88d8f0c7').length).toBeLessThanOrEqual(64);
  });
  it('보관값이 없으면(사파리로 열림) 토스 orderId에서 "SD-"를 떼어 우리 주문을 찾는다', async () => {
    expect(orderIdOfToss('SD-o1')).toBe('o1');
    const d = deps([{ state: 'HELD' }, { state: 'CONFIRMED' }]);
    const r = await processTossSuccess({ ...params, orderId: 'SD-o1' }, null, d);
    expect(d.getCheckout).toHaveBeenCalledWith('o1'); expect(r.kind).toBe('confirmed');
  });
});

describe('결제 확정', () => {
  it('승인 요청 후 확정(CONFIRMED)이면 결제 완료', async () => {
    const d = deps([{ state: 'HELD' }, { state: 'VERIFYING_PAYMENT' }, { state: 'CONFIRMED' }]);
    const r = await processTossSuccess(params, null, d);
    expect(r.kind).toBe('confirmed'); expect(d.requestPayment).toHaveBeenCalledTimes(1);
    expect(d.requestPayment.mock.calls[0]).toEqual(['o1', expect.objectContaining({ paymentKey: 'pk_1', termsVersion: 'v1', requestKey: expect.any(String) })]);
  });
  it('새로고침해 다시 처리해도 승인 요청은 한 번만(이미 보냈으면 확인만)', async () => {
    await processTossSuccess(params, null, deps([{ state: 'HELD' }, { state: 'CONFIRMED' }]));
    const d2 = deps([{ state: 'HELD' }, { state: 'CONFIRMED' }]); const r = await processTossSuccess(params, null, d2);
    expect(d2.requestPayment).not.toHaveBeenCalled(); expect(r.kind).toBe('confirmed');
  });
  it('결과 불명(5xx)으로 실패한 요청은 다음에 같은 requestKey로 다시 보낸다', async () => {
    const first = deps([{ state: 'HELD' }]); first.requestPayment.mockRejectedValue(new ApiError('x', 503, 'ORDER_UNAVAILABLE'));
    await processTossSuccess(params, null, first);
    const ok = deps([{ state: 'HELD' }, { state: 'CONFIRMED' }]); await processTossSuccess(params, null, ok);
    expect(ok.requestPayment).toHaveBeenCalledTimes(1); expect(ok.requestPayment.mock.calls[0][1].requestKey).toBe(first.requestPayment.mock.calls[0][1].requestKey);
    expect(sentRecord('o1', 'pk_1').done).toBe(true);
  });
  it('금액이 주문 금액과 다르면 승인 요청 없이 실패', async () => {
    const d = deps([{ state: 'HELD', totalAmount: 21000 }]);
    const r = await processTossSuccess({ ...params, amount: 1000 }, null, d);
    expect(r).toMatchObject({ kind: 'failed', code: 'AMOUNT_MISMATCH' }); expect(d.requestPayment).not.toHaveBeenCalled();
  });
  it('결제창을 열 때 보관한 금액과도 비교하고, 토스 orderId로 우리 주문을 찾는다', async () => {
    const d = deps([{ state: 'HELD', totalAmount: 21000 }]);
    const r = await processTossSuccess({ ...params, orderId: 'toss-1' }, { orderId: 'o1', tossOrderId: 'toss-1', amount: 20000 }, d);
    expect(d.getCheckout).toHaveBeenCalledWith('o1'); expect(r).toMatchObject({ kind: 'failed', code: 'AMOUNT_MISMATCH', orderId: 'o1' });
  });
  it('서버가 실패(FAILED)로 끝내면 failureCode로 실패', async () => {
    const r = await processTossSuccess(params, null, deps([{ state: 'HELD' }, { state: 'FAILED', failureCode: 'PAYMENT_NOT_COMPLETED' }]));
    expect(r).toMatchObject({ kind: 'failed', code: 'PAYMENT_NOT_COMPLETED' });
  });
  it('끝내 확정되지 않으면 실패가 아니라 지연', async () => {
    const r = await processTossSuccess(params, null, deps([{ state: 'HELD' }, { state: 'VERIFYING_PAYMENT' }]));
    expect(r).toEqual({ kind: 'delayed', orderId: 'o1' });
  });
  it('확인 중 일시 오류(503)는 계속 확인한다', async () => {
    let i = 0; const d = deps([]); d.getCheckout.mockImplementation(async () => { i++; if (i === 2) throw new ApiError('x', 503, 'X'); return cmd({ state: i >= 3 ? 'CONFIRMED' : 'HELD' }); });
    expect((await processTossSuccess(params, null, d)).kind).toBe('confirmed');
  });
  it('확인 간격: 처음 1분 2초, 이어서 2분 5초', () => {
    expect(CONFIRM_POLL_MS.filter(x => x === 2000)).toHaveLength(30); expect(CONFIRM_POLL_MS.filter(x => x === 5000)).toHaveLength(24);
  });
});

describe('결제창 실패(failUrl)', () => {
  it('사용자가 닫으면(PAY_PROCESS_CANCELED) 결제를 취소했어요', () => { expect(tossFailure('o1', 'PAY_PROCESS_CANCELED', '사용자가 결제를 취소하였습니다')).toEqual({ kind: 'failed', orderId: 'o1', code: 'PAY_PROCESS_CANCELED', message: '결제를 취소했어요' }); });
  it('그 밖의 실패는 토스 message 그대로', () => { expect(tossFailure('o1', 'REJECT_CARD_COMPANY', '카드사 거절')).toMatchObject({ code: 'REJECT_CARD_COMPANY', message: '카드사 거절' }); });
});
