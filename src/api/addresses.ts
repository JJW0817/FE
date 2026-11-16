/**
 * 배송지 도메인(구매자) — 명세 docs/api-spec.md 2절 중 배송지 API 7개. Account service(`account`).
 * 실제 모드: API만 호출(실패는 그대로 던져 화면이 보여 준다). mock 모드: localStorage 목업 그대로.
 * 화면은 SavedAddress(빈 값은 '')를 쓰므로 여기서 DTO(null 가능)를 변환한다.
 */
import { USE_MOCK } from '../config';
import { api } from './client';
import type { AddressDto } from './types';

export type SavedAddress = { addressId: string; label: string; recipientName: string; recipientPhone: string; postalCode: string; roadAddress: string; detailAddress: string; deliveryMemo: string; defaultAddress: boolean };
export type AddressBody = Omit<SavedAddress, 'addressId' | 'defaultAddress'>;

const account = 'account' as const;
const enc = encodeURIComponent;
const BASE = '/v1/accounts/me/addresses';

export const savedAddressFromApi = (d: AddressDto): SavedAddress => ({
  addressId: d.addressId, label: d.label, recipientName: d.recipientName, recipientPhone: d.recipientPhone, postalCode: d.postalCode,
  roadAddress: d.roadAddress, detailAddress: d.detailAddress ?? '', deliveryMemo: d.deliveryMemo ?? '', defaultAddress: d.defaultAddress,
});
/** 선택 필드(detailAddress·deliveryMemo)는 비면 보내지 않는다 */
const bodyToApi = (b: AddressBody) => ({ ...b, detailAddress: b.detailAddress || undefined, deliveryMemo: b.deliveryMemo || undefined });

/* ── API ── */
/** GET /v1/accounts/me/addresses */
export async function fetchAddresses(signal?: AbortSignal): Promise<SavedAddress[]> {
  return (await api.get<AddressDto[]>(BASE, { service: account, signal })).map(savedAddressFromApi);
}
/** GET /v1/accounts/me/addresses/{id} */
export async function fetchAddress(id: string, signal?: AbortSignal): Promise<SavedAddress> {
  return savedAddressFromApi(await api.get<AddressDto>(`${BASE}/${enc(id)}`, { service: account, signal }));
}
/** POST /v1/accounts/me/addresses — 201, 응답은 {addressId, defaultAddress}만 (첫 배송지는 자동 기본) */
export const createAddress = (b: AddressBody) => api.post<{ addressId: string; defaultAddress: boolean }>(BASE, bodyToApi(b), { service: account });
/** PUT /v1/accounts/me/addresses/{id} */
export const updateAddress = (id: string, b: AddressBody) => api.put<null>(`${BASE}/${enc(id)}`, bodyToApi(b), { service: account });
/** PUT /v1/accounts/me/addresses/{id}/default — 본문 없음 */
export const putDefaultAddress = (id: string) => api.put<null>(`${BASE}/${enc(id)}/default`, undefined, { service: account });
/** DELETE — 기본 배송지를 다른 배송지가 남은 채 지우면 409 ADDRESS_DEFAULT_CHANGE_REQUIRED */
export const removeAddress = (id: string) => api.delete<null>(`${BASE}/${enc(id)}`, { service: account });

/* ── mock 모드: localStorage 목업 (Figma 예시 값) ── */
const LOCAL_KEY = 'stockdrop:addresses-mock';
const MOCK_ADDRESSES: SavedAddress[] = [
  { addressId: 'addr-home', label: '집', recipientName: '김서윤', recipientPhone: '010-1234-5678', postalCode: '04066', roadAddress: '서울특별시 마포구 와우산로 94', detailAddress: '3층 302호', deliveryMemo: '문 앞에 놓아주세요', defaultAddress: true },
  { addressId: 'addr-office', label: '회사', recipientName: '김지우', recipientPhone: '010-1234-5678', postalCode: '06236', roadAddress: '서울특별시 강남구 테헤란로 152', detailAddress: '강남파이낸스센터 12층', deliveryMemo: '경비실에 맡겨주세요', defaultAddress: false },
  { addressId: 'addr-parents', label: '부모님 댁', recipientName: '김영숙', recipientPhone: '010-9876-5432', postalCode: '13494', roadAddress: '경기도 성남시 분당구 판교역로 235', detailAddress: '101동 1203호', deliveryMemo: '배송 전 연락 부탁드려요', defaultAddress: false },
];
function readLocal(): SavedAddress[] { try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); if (Array.isArray(v)) return v; } catch { /* 목업으로 복구 */ } return structuredClone(MOCK_ADDRESSES); }
function writeLocal(list: SavedAddress[]) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* 저장 차단 시 메모리 값만 사용 */ } }

/* ── 화면이 쓰는 함수: 모드에 따라 분기 ── */
export async function listAddresses(signal?: AbortSignal): Promise<SavedAddress[]> {
  return USE_MOCK ? readLocal() : fetchAddresses(signal);
}
export async function saveAddress(id: string | null, body: AddressBody, makeDefault: boolean): Promise<SavedAddress> {
  if (!USE_MOCK) {
    let addressId = id ?? '', isDefault = makeDefault;
    if (id) await updateAddress(id, body);
    else { const c = await createAddress(body); addressId = c.addressId; isDefault = c.defaultAddress; }
    if (makeDefault && !isDefault) { await putDefaultAddress(addressId); isDefault = true; }
    return { ...body, addressId, defaultAddress: isDefault };
  }
  const list = readLocal(); const addressId = id ?? `addr-${Date.now()}`;
  const next: SavedAddress = { ...body, addressId, defaultAddress: makeDefault || !list.length };
  const merged = id ? list.map(a => a.addressId === id ? { ...next, defaultAddress: makeDefault || a.defaultAddress } : a) : [...list, next];
  writeLocal(next.defaultAddress ? merged.map(a => ({ ...a, defaultAddress: a.addressId === addressId })) : merged);
  return next;
}
export async function setDefaultAddress(id: string) {
  if (!USE_MOCK) { await putDefaultAddress(id); return; }
  writeLocal(readLocal().map(a => ({ ...a, defaultAddress: a.addressId === id })));
}
export async function deleteAddress(id: string) {
  if (!USE_MOCK) { await removeAddress(id); return; }
  writeLocal(readLocal().filter(a => a.addressId !== id));
}
