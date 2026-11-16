/**
 * 현재 위치 → 주소. 명세(docs/api-spec.md)에 좌표→주소 API가 없어 카카오 지도 JS SDK의 services.Geocoder(coord2Address)를 쓴다.
 * 키·도메인 등록은 docs/kakao.md. mock 모드는 고정 좌표·고정 주소로 네트워크를 쓰지 않는다.
 */
import { USE_MOCK } from './config';

export interface PickedAddress { postalCode: string; roadAddress: string; jibunAddress: string }
interface Coord2AddressItem { road_address: { address_name: string; zone_no: string } | null; address: { address_name: string } | null }
declare global { interface Window { kakao?: { maps: { load: (cb: () => void) => void; services: { Status: { OK: string }; Geocoder: new () => { coord2Address: (lng: number, lat: number, cb: (r: Coord2AddressItem[], status: string) => void) => void } } } } } }

/** mock 모드 고정 좌표(서울시청)와 그 주소 */
export const MOCK_COORD = { latitude: 37.5663, longitude: 126.9779 };
const MOCK_ADDRESS: PickedAddress = { postalCode: '04524', roadAddress: '서울 중구 세종대로 110', jibunAddress: '서울 중구 태평로1가 31' };

/** coord2Address 결과 첫 항목 → 화면 값. 도로명이 없는 곳(산·논밭 등)은 지번을 기본 주소로 쓰고 우편번호는 비운다 */
export function toPicked(items: Coord2AddressItem[]): PickedAddress | null {
  const it = items[0]; if (!it || (!it.road_address && !it.address)) return null;
  const jibun = it.address?.address_name ?? '';
  return { postalCode: it.road_address?.zone_no ?? '', roadAddress: it.road_address?.address_name || jibun, jibunAddress: jibun };
}
/** GeolocationPositionError.code → 안내 문구 */
export function geoErrorMessage(code: number) {
  return code === 1 ? '위치 권한이 거부됐어요. 브라우저 설정에서 위치 권한을 허용하거나 주소 검색을 이용해 주세요.'
    : code === 3 ? '현재 위치를 찾는 데 시간이 너무 오래 걸려요. 다시 시도하거나 주소 검색을 이용해 주세요.'
    : '현재 위치를 찾을 수 없어요. 주소 검색을 이용해 주세요.';
}

let sdk: Promise<NonNullable<Window['kakao']>> | null = null;
function loadKakao(key: string) {
  return sdk ??= new Promise((resolve, reject) => {
    if (window.kakao?.maps) { window.kakao.maps.load(() => resolve(window.kakao!)); return; }
    const el = document.createElement('script');
    el.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    el.onload = () => window.kakao ? window.kakao.maps.load(() => resolve(window.kakao!)) : reject(new Error('카카오 지도 스크립트를 불러오지 못했어요.'));
    el.onerror = () => { sdk = null; reject(new Error('카카오 지도 스크립트를 불러오지 못했어요. 키·도메인 등록을 확인해 주세요.')); };
    document.head.appendChild(el);
  });
}
function position(): Promise<{ latitude: number; longitude: number }> {
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(p => resolve(p.coords), e => reject(new Error(geoErrorMessage(e.code))), { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }));
}

export async function currentAddress(): Promise<PickedAddress> {
  if (USE_MOCK) return MOCK_ADDRESS;
  if (!window.isSecureContext) throw new Error('현재 위치는 https 주소(또는 localhost)에서만 쓸 수 있어요. 주소 검색을 이용해 주세요.');
  if (!navigator.geolocation) throw new Error('이 브라우저는 현재 위치를 지원하지 않아요. 주소 검색을 이용해 주세요.');
  const key = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
  if (!key) throw new Error('카카오 지도 키(VITE_KAKAO_JS_KEY)가 설정되지 않았어요. 주소 검색을 이용해 주세요.');
  const [{ latitude, longitude }, kakao] = await Promise.all([position(), loadKakao(key)]);
  const items = await new Promise<Coord2AddressItem[]>((resolve, reject) => new kakao.maps.services.Geocoder().coord2Address(longitude, latitude, (r, status) => status === kakao.maps.services.Status.OK ? resolve(r) : reject(new Error('현재 위치의 주소를 찾지 못했어요. 주소 검색을 이용해 주세요.'))));
  const picked = toPicked(items);
  if (!picked) throw new Error('현재 위치의 주소를 찾지 못했어요. 주소 검색을 이용해 주세요.');
  return picked;
}
