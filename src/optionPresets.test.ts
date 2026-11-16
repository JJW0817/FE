import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { optionPayload } from './api/sellerProducts';
import { blankDraft, listingDimensions } from './domain';
import { optionPresetFor } from './optionPresets';

const meta = JSON.parse(readFileSync('docs/registration-metadata.json', 'utf-8')) as never;
describe('카테고리별 추천 옵션', () => {
  it('의류는 사이즈(S·M·L·XL 빠른 선택), 신발은 사이즈(mm), 문구는 규격·묶음 수량, 생활잡화는 크기·용량', () => {
    expect(optionPresetFor('반팔 티셔츠', meta)).toEqual({ second: ['사이즈'], quick: { 사이즈: ['S', 'M', 'L', 'XL'] } });
    expect(optionPresetFor('스니커즈', meta).second).toEqual(['사이즈(mm)']); expect(optionPresetFor('스니커즈', meta).quick['사이즈(mm)'].slice(0, 2)).toEqual(['220', '230']);
    expect(optionPresetFor('백팩', meta).second).toEqual(['사이즈']);
    expect(optionPresetFor('볼펜', meta).second).toEqual(['규격', '묶음 수량']);
    expect(optionPresetFor('수납함'.length ? '덮개형 수납함' : '', meta).second).toEqual(['크기', '용량']);
    expect(optionPresetFor('', meta).second).toEqual(['사이즈']);
  });
  it('직접 입력한 옵션 이름이 화면 옵션 축·서버 전송에 그대로 쓰인다', () => {
    const d = { ...blankDraft(), axes: { color: true, size: true }, sizeName: '묶음 수량', colors: ['블랙'], sizes: ['3개입'], stock: { '블랙|3개입': 5 } };
    expect(listingDimensions(d)).toEqual([{ name: '색상', values: '블랙' }, { name: '묶음 수량', values: '3개입' }]);
    expect(optionPayload(d).dimensions).toEqual([{ name: '색상', values: ['블랙'] }, { name: '묶음 수량', values: ['3개입'] }]);
  });
});
