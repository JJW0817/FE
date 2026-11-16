import { describe, expect, it, vi } from 'vitest';
// store.ts가 import 시점에 window·localStorage를 쓴다(node 환경에는 없음)
const mem = new Map<string, string>();
vi.stubGlobal('localStorage', { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v), removeItem: (k: string) => void mem.delete(k) });
vi.stubGlobal('window', { addEventListener: () => {}, removeEventListener: () => {}, localStorage });
const { AI_MESSAGES, aiStateOf, editBlocker } = await import('./wizard');

describe('판매 정보 수정 가능 여부(서버 status 기준)', () => {
  const now = Date.parse('2026-11-12T00:00:00Z'), future = Date.parse('2026-11-12T01:30:00Z'), past = Date.parse('2026-11-11T00:00:00Z');
  it('반려·초안은 판매 시작 시각과 무관하게 수정 가능', () => {
    expect(editBlocker({ reviewStatus: 'REJECTED', startsAt: past }, now)).toBeNull();
    expect(editBlocker({ reviewStatus: 'REJECTED', startsAt: 0 }, now)).toBeNull();
    expect(editBlocker({ reviewStatus: 'DRAFT', startsAt: 0 }, now)).toBeNull();
  });
  it('심사 중은 불가, 승인은 판매 시작 전만', () => {
    expect(editBlocker({ reviewStatus: 'IN_REVIEW', startsAt: future }, now)).toContain('심사 중');
    expect(editBlocker({ reviewStatus: 'APPROVED', startsAt: future }, now)).toBeNull();
    expect(editBlocker({ reviewStatus: 'APPROVED', startsAt: past }, now)).toContain('판매 시작 후');
  });
});

describe('AI 결과(outcome) → 초안 상태', () => {
  const q = [{ checkCode: 'C1', question: '실측?', reason: '사진만으로 모름' }];
  it('RECOMMENDED는 추천 카테고리·질문만 담는다(신뢰도·대안 없음)', () => {
    expect(aiStateOf('t', { outcome: 'RECOMMENDED', code: 'CLOTHING', category: '의류', questions: q }, 2)).toEqual({ status: 'recommended', signature: 't', category: '', reason: '', result: { code: 'CLOTHING', category: '의류', photos: 2, questions: q } });
  });
  it('NOT_APPLICABLE·UNCLEAR는 실패가 아니라 안내 문구', () => {
    expect(aiStateOf('t', { outcome: 'NOT_APPLICABLE', code: '', category: '', questions: [] }, 1)).toMatchObject({ status: 'uncertain', reason: AI_MESSAGES.NOT_APPLICABLE });
    expect(aiStateOf('t', { outcome: 'UNCLEAR', code: '', category: '', questions: [] }, 1)).toMatchObject({ status: 'uncertain', reason: AI_MESSAGES.UNCLEAR });
    expect(aiStateOf('t', { outcome: 'RECOMMENDED', code: 'X', category: '', questions: [] }, 1)).toMatchObject({ status: 'uncertain', reason: AI_MESSAGES.NO_CATEGORY });
  });
});
