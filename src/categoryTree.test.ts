import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { categoryTree, groupOf, OTHER_GROUP } from './categoryTree';

const meta = JSON.parse(readFileSync('docs/registration-metadata.json', 'utf-8')) as { categoryCriteria: { code: string; name: string }[] };
describe('카테고리 단계 선택', () => {
  it('실제 서버 응답의 세부 카테고리 255개가 모두 한 번씩 들어가고, 대분류 4개 밖의 항목은 기타로 가지 않는다', () => {
    const tree = categoryTree(meta as never), all = tree.flatMap(m => m.groups.flatMap(g => g.items));
    expect(tree.map(m => m.code)).toEqual(['CLOTHING', 'FASHION_ACCESSORIES', 'STATIONERY', 'HOUSEHOLD']);
    expect(all.length).toBe(255); expect(new Set(all).size).toBe(255);
    const stray = meta.categoryCriteria.filter(c => !['CLOTHING', 'FASHION_ACCESSORIES', 'STATIONERY', 'HOUSEHOLD'].includes(c.code) && groupOf(c.code) === OTHER_GROUP);
    expect(stray.map(c => c.code)).toEqual([]);
  });
  it('의류 → 티셔츠 → 반팔 티셔츠, 모르는 토큰은 기타', () => {
    const tree = categoryTree(meta as never);
    expect(tree[0].groups.find(g => g.label === '티셔츠')?.items).toContain('반팔 티셔츠');
    expect(groupOf('CLOTHING_NEWTHING_01')).toBe(OTHER_GROUP);
    expect(tree[0].groups.at(-1)?.label).toBe(OTHER_GROUP); // 기타는 맨 뒤
  });
});
