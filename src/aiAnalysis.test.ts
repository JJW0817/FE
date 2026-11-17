import { afterEach, describe, expect, it, vi } from 'vitest';
import { api, ApiError } from './api/client';
import { AI_POLL_MS, AiDelayedError, faqsToSave, pollAiAnalysis, withFaqRetry } from './api/sellerProducts';
import { analysisInputOf, analysisStale, blankDraft } from './domain';
import type { Draft } from './domain';

afterEach(() => vi.restoreAllMocks());
const done = { requestId: 'r', productId: 'p', productVersion: 1, fingerprint: 'f', status: 'COMPLETED', attempts: 1, nextAttemptAt: null, result: { requestId: 'r', productId: 'p', sellerId: 's', fingerprint: 'f', outcome: 'RECOMMENDED', recommendedCategory: 'CLOTHING', questions: [] } };

describe('AI 분석 확인', () => {
  it('간격: 처음 1분 2초(30번), 이어서 2분 5초(24번) = 최대 3분', () => {
    expect(AI_POLL_MS.slice(0, 30).every(x => x === 2000)).toBe(true); expect(AI_POLL_MS.slice(30).every(x => x === 5000)).toBe(true);
    expect(AI_POLL_MS.reduce((a, b) => a + b, 0)).toBe(180_000);
  });
  it('PENDING·RUNNING·RETRY는 실패가 아니라 계속 확인하고, RETRY는 진행 콜백으로 attempts·nextAttemptAt을 알린다', async () => {
    const seq = [{ status: 'PENDING' }, { status: 'RUNNING' }, { status: 'RETRY', attempts: 2, nextAttemptAt: '2026-11-17T03:30:00Z' }, done];
    let i = 0; vi.spyOn(api, 'get').mockImplementation(async () => seq[i++]);
    const seen: unknown[] = []; const r = await pollAiAnalysis('r', { schedule: [0, 0, 0, 0], sleep: async () => {}, onProgress: p => seen.push(p.status === 'RETRY' ? [p.status, p.attempts, p.nextAttemptAt] : p.status) });
    expect(r.outcome).toBe('RECOMMENDED'); expect(seen).toEqual(['PENDING', 'RUNNING', ['RETRY', 2, '2026-11-17T03:30:00Z'], 'COMPLETED']);
  });
  it('끝내 안 끝나면 실패가 아니라 AiDelayedError(다시 확인)', async () => {
    vi.spyOn(api, 'get').mockResolvedValue({ status: 'RUNNING', attempts: 0, nextAttemptAt: null, result: null });
    await expect(pollAiAnalysis('r', { schedule: [0, 0], sleep: async () => {} })).rejects.toBeInstanceOf(AiDelayedError);
  });
  it('404 AI_NOT_FOUND(이벤트 지연)는 재시도, 다른 오류는 그대로', async () => {
    const g = vi.spyOn(api, 'get').mockRejectedValueOnce(new ApiError('x', 404, 'AI_NOT_FOUND')).mockResolvedValueOnce(done);
    expect((await pollAiAnalysis('r', { schedule: [0, 0], sleep: async () => {} })).outcome).toBe('RECOMMENDED'); expect(g).toHaveBeenCalledTimes(2);
    g.mockRejectedValue(new ApiError('boom', 500, 'X')); await expect(pollAiAnalysis('r', { schedule: [0], sleep: async () => {} })).rejects.toMatchObject({ status: 500 });
  });
});

describe('분석 뒤 정보가 바뀐 경우', () => {
  const base = (): Draft => { const d = { ...blankDraft(), name: '티셔츠', description: '설명', brand: 'A', originalUrl: 'https://x.co/1', category: '', reason: '재고', images: ['a', 'b'] }; return { ...d, ai: { ...d.ai, status: 'recommended', input: analysisInputOf(d), result: { code: 'CLOTHING', category: '반팔 티셔츠', photos: 2, questions: [{ suggestionId: 's1', question: 'Q1', reason: '' }] } } }; };
  it('분석 직후나 값이 같으면 바뀌지 않은 것', () => { expect(analysisStale(base())).toBe(false); });
  it.each([['name', '다른 이름'], ['description', '다른 설명'], ['brand', 'B'], ['originalUrl', 'https://x.co/2'], ['reason', '다른 사유']] as const)('%s이 바뀌면 다시 분석', (k, v) => { expect(analysisStale({ ...base(), [k]: v })).toBe(true); });
  it('사진 목록이 바뀌면 다시 분석(순서 포함)', () => { expect(analysisStale({ ...base(), images: ['a'] })).toBe(true); expect(analysisStale({ ...base(), images: ['b', 'a'] })).toBe(true); });
  it('카테고리는 AI 추천값으로 바꾼 것만 예외, 다른 값으로 바꾸면 다시 분석', () => { expect(analysisStale({ ...base(), category: '반팔 티셔츠' })).toBe(false); expect(analysisStale({ ...base(), category: '볼펜' })).toBe(true); });
  it('분석 결과가 없으면(분석 없이 등록) 바뀐 것으로 보지 않는다', () => { const d = base(); expect(analysisStale({ ...d, ai: { ...d.ai, result: undefined } })).toBe(false); });
});

describe('AI 질문 답 → FAQ', () => {
  const draft = (over: Partial<Draft> = {}): Draft => { const d = blankDraft(); return { ...d, name: 'n', images: ['a'], faqs: [{ id: 'faq-1', question: 'AI 질문 원문', answer: '답', confirmed: true, suggestionId: 's1' }, { id: 'faq-2', question: '직접', answer: '답2', confirmed: true }, { id: 'faq-3', question: '빈 답', answer: ' ', confirmed: true, suggestionId: 's2' }], ai: { ...d.ai, input: analysisInputOf({ ...d, name: 'n', images: ['a'] }), result: { code: 'C', category: 'c', photos: 1, questions: [{ suggestionId: 's1', question: 'AI 질문 원문', reason: '' }, { suggestionId: 's2', question: 'Q2', reason: '' }] } }, ...over }; };
  it('질문 원문·답·suggestionId를 보내고 빈 답은 뺀다', () => {
    expect(faqsToSave(draft())).toEqual([{ id: undefined, question: 'AI 질문 원문', answer: '답', suggestionId: 's1' }, { id: undefined, question: '직접', answer: '답2' }]);
  });
  it('분석 뒤 입력이 바뀌면 그 분석의 질문 답은 보내지 않는다(직접 쓴 FAQ는 유지)', () => {
    expect(faqsToSave({ ...draft(), name: '바뀐 이름' }).map(f => f.question)).toEqual(['직접']);
  });
  it('저장이 거절되면 1초 간격으로 총 3번까지 재시도', async () => {
    const waits: number[] = []; let n = 0;
    const r = await withFaqRetry(async () => { if (++n < 3) throw new ApiError('아직', 409, 'PRODUCT_STATE'); return 'ok'; }, true, async ms => { waits.push(ms); });
    expect(r).toBe('ok'); expect(n).toBe(3); expect(waits).toEqual([1000, 1000]);
    n = 0; await expect(withFaqRetry(async () => { n++; throw new ApiError('계속', 400, 'X'); }, true, async () => {})).rejects.toMatchObject({ status: 400 }); expect(n).toBe(3);
  });
  it('AI 질문 답이 없으면 재시도하지 않고, 401·5xx도 재시도하지 않는다', async () => {
    let n = 0; await expect(withFaqRetry(async () => { n++; throw new ApiError('x', 409, 'X'); }, false, async () => {})).rejects.toBeDefined(); expect(n).toBe(1);
    n = 0; await expect(withFaqRetry(async () => { n++; throw new ApiError('x', 500, 'X'); }, true, async () => {})).rejects.toBeDefined(); expect(n).toBe(1);
  });
});

describe('분석은 선택', () => {
  it('AI 분석 없이 카테고리만 고르면 심사 요청 검사에 분석 관련 문제가 없다', async () => {
    const { listingProblems } = await import('./api/sellerProducts');
    const d = { ...blankDraft(), name: 'n', description: 'd', reason: 'r', images: ['a'], category: '볼펜', originalUrl: 'https://x.co/1', price: 1000, stock: { '|': 1 }, axes: { size: false, color: false } };
    const p = listingProblems(d, { categories: ['볼펜'], now: 0, dispatch: true, return: true });
    expect(d.ai.status).toBe('before'); expect(Object.keys(p)).not.toContain('state'); expect(Object.keys(p)).not.toContain('category'); expect(Object.keys(p).filter(k => /ai|analysis/i.test(k))).toEqual([]);
  });
});
