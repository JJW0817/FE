import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { GROUP_LABELS, categoryTree, groupOf, OTHER_GROUP } from './categoryTree';

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

describe('중분류 묶음 규칙: 대분류 코드+"_"를 떼고 끝의 "_번호"를 뗀 나머지 전체', () => {
  const MAJ = ['CLOTHING', 'FASHION_ACCESSORIES', 'STATIONERY', 'HOUSEHOLD'];
  const token = (code: string) => { const m = MAJ.find(x => code.startsWith(`${x}_`))!; return `${m}:${code.slice(m.length + 1).replace(/_\d+$/, '')}`; };
  const keys = [...new Set(meta.categoryCriteria.filter(c => !MAJ.includes(c.code)).map(c => token(c.code)))];
  it('서버 응답의 중분류는 정확히 57개이고 GROUP_LABELS가 57개 전부를 한글 이름으로 가진다(남거나 모자라지 않게)', () => {
    expect(keys).toHaveLength(57);
    expect(keys.filter(k => !(k in GROUP_LABELS))).toEqual([]);
    expect(Object.keys(GROUP_LABELS).filter(k => !keys.includes(k))).toEqual([]);
    expect(Object.keys(GROUP_LABELS)).toHaveLength(57);
    for (const m of MAJ) { const names = Object.entries(GROUP_LABELS).filter(([k]) => k.startsWith(`${m}:`)).map(([, v]) => v); expect(new Set(names).size).toBe(names.length); } // 같은 대분류 안에서 이름이 겹치지 않음
  });
  it('255개 세부 카테고리가 전부 자기 중분류에 들어간다(대분류 4개 항목만 기타)', () => {
    const tree = categoryTree(meta as never), all = tree.flatMap(m => m.groups.flatMap(g => g.items.map(i => [m.code, g.label, i])));
    expect(all).toHaveLength(255);
    expect(all.filter(([, g]) => g === OTHER_GROUP).map(([, , i]) => i).sort()).toEqual(['문구', '의류', '일반 생활잡화', '패션잡화'].sort());
  });
  it('밑줄이 들어간 중분류도 맞게: HOUSEHOLD_CLOTHING_STORAGE_01은 생활잡화의 의류 수납(의류 아님), FASHION_ACCESSORIES_BAG_01은 가방', () => {
    expect(groupOf('HOUSEHOLD_CLOTHING_STORAGE_01')).toBe('의류 수납'); expect(groupOf('FASHION_ACCESSORIES_BAG_01')).toBe('가방');
    expect(token('HOUSEHOLD_CLOTHING_STORAGE_01')).toBe('HOUSEHOLD:CLOTHING_STORAGE');
    for (const [code, name] of [['STATIONERY_PEN_STORAGE_01', '필통·펜 케이스'], ['HOUSEHOLD_SHOE_STORAGE_01', '신발 수납'], ['HOUSEHOLD_SMALL_STORAGE_01', '소품 수납'], ['HOUSEHOLD_FLOOR_CLEANING_01', '바닥 청소'], ['HOUSEHOLD_GARMENT_CARE_01', '의류 관리'], ['HOUSEHOLD_WALL_STORAGE_01', '벽 수납·후크']]) expect(groupOf(code)).toBe(name);
    const tree = categoryTree(meta as never), cl = tree.find(m => m.code === 'CLOTHING')!; expect(cl.groups.some(g => g.label === '의류 수납')).toBe(false);
  });
});
