import { describe, expect, it } from 'vitest';
import { geoErrorMessage, toPicked } from './geo';

describe('현재 위치 → 주소', () => {
  it('도로명·우편번호·지번을 채운다', () => {
    expect(toPicked([{ road_address: { address_name: '서울 중구 세종대로 110', zone_no: '04524' }, address: { address_name: '서울 중구 태평로1가 31' } }]))
      .toEqual({ postalCode: '04524', roadAddress: '서울 중구 세종대로 110', jibunAddress: '서울 중구 태평로1가 31' });
  });
  it('도로명이 없으면 지번을 기본 주소로, 우편번호는 비운다', () => {
    expect(toPicked([{ road_address: null, address: { address_name: '강원 평창군 진부면 산1' } }])).toEqual({ postalCode: '', roadAddress: '강원 평창군 진부면 산1', jibunAddress: '강원 평창군 진부면 산1' });
  });
  it('결과가 없으면 null', () => { expect(toPicked([])).toBeNull(); });
  it('권한 거부·시간 초과 문구', () => { expect(geoErrorMessage(1)).toContain('권한'); expect(geoErrorMessage(3)).toContain('시간'); });
});
