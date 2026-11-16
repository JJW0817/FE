import { afterEach, describe, expect, it } from 'vitest';
import { api } from './client';
import { createAddress, fetchAddresses, removeAddress, saveAddress, setDefaultAddress } from './addresses';
import type { AddressDto } from './types';

const dto: AddressDto = { addressId: 'a1', label: '집', recipientName: '김', recipientPhone: '010-1111-2222', postalCode: '04066', roadAddress: '도로 1', detailAddress: null, deliveryMemo: null, defaultAddress: true, createdAt: 'x', updatedAt: 'x' };
const body = { label: '집', recipientName: '김', recipientPhone: '010-1111-2222', postalCode: '04066', roadAddress: '도로 1', detailAddress: '', deliveryMemo: '' };
type Call = { url: string; method: string; body: unknown };
function fake(handler: (c: Call) => unknown) {
  const calls: Call[] = [];
  api.configure({ mock: false, fetch: (async (u: RequestInfo | URL, init?: RequestInit) => {
    const c = { url: String(u), method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined }; calls.push(c);
    return new Response(JSON.stringify({ success: true, code: 'COMMON_SUCCESS', message: '', data: handler(c) }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch });
  return calls;
}
afterEach(() => api.configure({ fetch: undefined }));

describe('배송지 API', () => {
  it('목록: null 필드는 빈 문자열로 변환', async () => {
    const calls = fake(() => [dto]);
    expect(await fetchAddresses()).toEqual([{ ...body, addressId: 'a1', defaultAddress: true }]);
    expect(calls[0]).toMatchObject({ method: 'GET' }); expect(calls[0].url).toContain('/v1/accounts/me/addresses');
  });
  it('등록: 선택 필드 생략, 기본 지정은 PUT /default (첫 배송지는 자동 기본이면 생략)', async () => {
    const calls = fake(c => (c.method === 'POST' ? { addressId: 'n1', defaultAddress: false } : null));
    const r = await saveAddress(null, body, true);
    expect(r).toMatchObject({ addressId: 'n1', defaultAddress: true });
    expect(calls.map(c => c.method + ' ' + c.url.split('/v1')[1])).toEqual(['POST /accounts/me/addresses', 'PUT /accounts/me/addresses/n1/default']);
    expect(calls[0].body).not.toHaveProperty('detailAddress');
    const c2 = fake(() => ({ addressId: 'n2', defaultAddress: true }));
    await saveAddress(null, body, true); expect(c2).toHaveLength(1);
  });
  it('수정·기본·삭제', async () => {
    const calls = fake(() => null);
    await saveAddress('a1', body, false); await setDefaultAddress('a1'); await removeAddress('a1');
    expect(calls.map(c => c.method + ' ' + c.url.split('/v1')[1])).toEqual(['PUT /accounts/me/addresses/a1', 'PUT /accounts/me/addresses/a1/default', 'DELETE /accounts/me/addresses/a1']);
    await createAddress(body); expect(calls.at(-1)?.method).toBe('POST');
  });
  it('실패는 삼키지 않고 던진다', async () => {
    api.configure({ mock: false, fetch: (async () => new Response(JSON.stringify({ success: false, code: 'ADDRESS_DEFAULT_CHANGE_REQUIRED', message: 'x' }), { status: 409, headers: { 'content-type': 'application/json' } })) as typeof fetch });
    await expect(removeAddress('a1')).rejects.toMatchObject({ status: 409, code: 'ADDRESS_DEFAULT_CHANGE_REQUIRED' });
  });
});
