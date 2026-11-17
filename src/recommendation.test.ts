import { describe, expect, it, vi } from 'vitest';
import { applyRecommendation, recommendationOn } from './recommendation';

const deps = () => ({ saveRecommend: vi.fn(async (_on: boolean) => {}), enroll: vi.fn(async () => {}), withdraw: vi.fn(async () => {}) });

describe('맞춤 상품 알림 토글 = 분석 참여 + personalizedRecommendation', () => {
  it('켜면 분석 참여와 personalizedRecommendation true를 같이 저장', async () => {
    const d = deps(); await applyRecommendation(true, false, d);
    expect(d.saveRecommend.mock.calls).toEqual([[true]]); expect(d.enroll).toHaveBeenCalledTimes(1); expect(d.withdraw).not.toHaveBeenCalled();
  });
  it('끄면 분석 철회와 personalizedRecommendation false를 같이 저장', async () => {
    const d = deps(); await applyRecommendation(false, true, d);
    expect(d.saveRecommend.mock.calls).toEqual([[false]]); expect(d.withdraw).toHaveBeenCalledTimes(1); expect(d.enroll).not.toHaveBeenCalled();
  });
  it('분석 쪽이 실패하면 personalizedRecommendation을 원래 값으로 되돌리고 오류를 던진다', async () => {
    const d = deps(); d.enroll.mockRejectedValue(new Error('분석 실패'));
    await expect(applyRecommendation(true, false, d)).rejects.toThrow('분석 실패');
    expect(d.saveRecommend.mock.calls).toEqual([[true], [false]]);
  });
  it('personalizedRecommendation 저장이 실패하면 분석 API는 부르지 않는다', async () => {
    const d = deps(); d.saveRecommend.mockRejectedValueOnce(new Error('저장 실패'));
    await expect(applyRecommendation(false, true, d)).rejects.toThrow('저장 실패');
    expect(d.withdraw).not.toHaveBeenCalled(); expect(d.enroll).not.toHaveBeenCalled();
  });
  it('화면 표시: 둘 다 켜져 있을 때만 켜짐(서로 다르면 꺼짐)', () => {
    expect(recommendationOn(true, true)).toBe(true); expect(recommendationOn(true, false)).toBe(false); expect(recommendationOn(false, true)).toBe(false);
  });
});
