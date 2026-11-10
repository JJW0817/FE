import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, Info, LocateFixed, MapPin, Search, X } from 'lucide-react';
import { ErrorBox, Header, Toggle, useToast } from '../components/ui';
import { activeUser } from '../domain';
import type { Address } from '../domain';
import { mutate, useStore } from '../store';
import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from '../api';

/* ── 배송지 데이터: API 우선, 백엔드가 없으면 로컬 목업(Figma 예시 값) ───────────────── */
export type SavedAddress = { addressId: string; label: string; recipientName: string; recipientPhone: string; postalCode: string; roadAddress: string; detailAddress: string; deliveryMemo: string; defaultAddress: boolean };
const LOCAL_KEY = 'stockdrop:addresses-mock';
const MOCK_ADDRESSES: SavedAddress[] = [
  { addressId: 'addr-home', label: '집', recipientName: '김서윤', recipientPhone: '010-1234-5678', postalCode: '04066', roadAddress: '서울특별시 마포구 와우산로 94', detailAddress: '3층 302호', deliveryMemo: '문 앞에 놓아주세요', defaultAddress: true },
  { addressId: 'addr-office', label: '회사', recipientName: '김지우', recipientPhone: '010-1234-5678', postalCode: '06236', roadAddress: '서울특별시 강남구 테헤란로 152', detailAddress: '강남파이낸스센터 12층', deliveryMemo: '경비실에 맡겨주세요', defaultAddress: false },
  { addressId: 'addr-parents', label: '부모님 댁', recipientName: '김영숙', recipientPhone: '010-9876-5432', postalCode: '13494', roadAddress: '경기도 성남시 분당구 판교역로 235', detailAddress: '101동 1203호', deliveryMemo: '배송 전 연락 부탁드려요', defaultAddress: false },
];
export const DELIVERY_MEMOS = ['문 앞에 놓아주세요', '경비실에 맡겨주세요', '배송 전 연락 부탁드려요'];
let offline = false;
function readLocal(): SavedAddress[] { try { const v = JSON.parse(localStorage.getItem(LOCAL_KEY) || 'null'); if (Array.isArray(v)) return v; } catch { /* 목업으로 복구 */ } return structuredClone(MOCK_ADDRESSES); }
function writeLocal(list: SavedAddress[]) { try { localStorage.setItem(LOCAL_KEY, JSON.stringify(list)); } catch { /* 저장 차단 시 메모리 값만 사용 */ } }
export const toAddress = (a: SavedAddress): Address => ({ name: a.recipientName, phone: a.recipientPhone, address: a.roadAddress, detail: a.detailAddress, request: a.deliveryMemo, postalCode: a.postalCode });
export const addressLine = (a: SavedAddress) => `${a.postalCode ? `[${a.postalCode}] ` : ''}${a.roadAddress}${a.detailAddress ? `, ${a.detailAddress}` : ''}`;

export async function listAddresses(): Promise<SavedAddress[]> {
  try { const data = await apiGet('/accounts/me/addresses'); if (Array.isArray(data)) { offline = false; return data as SavedAddress[]; } } catch { /* 백엔드 없음 */ }
  offline = true; return readLocal();
}
type AddressBody = Omit<SavedAddress, 'addressId' | 'defaultAddress'>;
export async function saveAddress(id: string | null, body: AddressBody, makeDefault: boolean): Promise<SavedAddress> {
  if (!offline) {
    try {
      const saved = (id ? await apiPut(`/accounts/me/addresses/${id}`, body) : await apiPost('/accounts/me/addresses', body)) as SavedAddress | null;
      const addressId = saved?.addressId ?? id ?? '';
      if (makeDefault && addressId) await apiPatch(`/accounts/me/addresses/${addressId}/default`, {});
      return { ...body, addressId, defaultAddress: makeDefault };
    } catch (e) { if ((e as { status?: number }).status) throw e; offline = true; }
  }
  const list = readLocal(); const addressId = id ?? `addr-${Date.now()}`;
  const next: SavedAddress = { ...body, addressId, defaultAddress: makeDefault || !list.length };
  const merged = id ? list.map(a => a.addressId === id ? { ...next, defaultAddress: makeDefault || a.defaultAddress } : a) : [...list, next];
  writeLocal(next.defaultAddress ? merged.map(a => ({ ...a, defaultAddress: a.addressId === addressId })) : merged);
  return next;
}
export async function setDefaultAddress(id: string) {
  if (!offline) { try { await apiPatch(`/accounts/me/addresses/${id}/default`, {}); return; } catch { offline = true; } }
  writeLocal(readLocal().map(a => ({ ...a, defaultAddress: a.addressId === id })));
}
export async function deleteAddress(id: string) {
  if (!offline) { try { await apiDelete(`/accounts/me/addresses/${id}`); return; } catch { offline = true; } }
  writeLocal(readLocal().filter(a => a.addressId !== id));
}

/* ── 주소 검색 → 폼 복귀 시 선택 값 전달 ───────────────────────────────────────────── */
const DRAFT_KEY = 'stockdrop:address-form';
const PICK_KEY = 'stockdrop:address-pick';
/** 주소 검색에서 고른 값(우편번호·도로명 주소)을 한 번 꺼낸다 */
export function takeAddressPick(): { postalCode: string; roadAddress: string } | null { try { const v = JSON.parse(sessionStorage.getItem(PICK_KEY) || 'null'); sessionStorage.removeItem(PICK_KEY); return v; } catch { return null; } }
type FormValue = AddressBody & { makeDefault: boolean };
const emptyForm: FormValue = { label: '', recipientName: '', recipientPhone: '', postalCode: '', roadAddress: '', detailAddress: '', deliveryMemo: '', makeDefault: true };

/** 배송지 수정 / 새 배송지 입력 — Figma "배송지 수정", "새 배송지 입력" (같은 폼을 빈 상태로 재사용) */
export function AddressFormPage() {
  const { id } = useParams(); const isNew = !id; const s = useStore(); const user = activeUser(s);
  const navigate = useNavigate(); const location = useLocation(); const [params] = useSearchParams(); const toast = useToast();
  const returnTo = params.get('returnTo') || '/addresses';
  const [value, setValue] = useState<FormValue>(emptyForm); const [ready, setReady] = useState(false);
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const draftKey = `${DRAFT_KEY}:${location.pathname}`;

  useEffect(() => {
    let alive = true;
    (async () => {
      let base: FormValue = emptyForm;
      try { const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null'); if (draft) base = draft; } catch { /* 새로 시작 */ }
      if (base === emptyForm && id) { const found = (await listAddresses()).find(a => a.addressId === id); if (found) { const { addressId: _i, defaultAddress, ...rest } = found; base = { ...rest, makeDefault: defaultAddress }; } }
      try { const pick = JSON.parse(sessionStorage.getItem(PICK_KEY) || 'null'); if (pick) { base = { ...base, postalCode: pick.postalCode, roadAddress: pick.roadAddress }; sessionStorage.removeItem(PICK_KEY); } } catch { /* 선택 값 없음 */ }
      sessionStorage.removeItem(draftKey);
      if (alive) { setValue(base); setReady(true); }
    })();
    return () => { alive = false; };
  }, [id]);

  const set = (patch: Partial<FormValue>) => { setError(''); setValue(v => ({ ...v, ...patch })); };
  const valid = value.recipientName.trim() && value.recipientPhone.trim() && value.roadAddress.trim() && value.detailAddress.trim();
  function openSearch() { sessionStorage.setItem(draftKey, JSON.stringify(value)); navigate(`/address-search?returnTo=${encodeURIComponent(location.pathname + location.search)}`); }
  async function submit() {
    if (!valid) { setError('받는 분·연락처·주소를 입력해 주세요.'); return; }
    if (value.postalCode && !/^\d{5}$/.test(value.postalCode.trim())) { setError('우편번호는 5자리 숫자로 입력해 주세요.'); return; }
    setBusy(true);
    try {
      const { makeDefault, ...body } = value;
      const saved = await saveAddress(id ?? null, { ...body, label: body.label.trim() || '배송지' }, makeDefault);
      if (saved.defaultAddress || returnTo.startsWith('/checkout')) mutate(state => { state.addresses[user.id] = toAddress(saved); });
      toast('배송지를 저장했습니다.'); navigate(returnTo, { replace: true });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const input = (key: keyof AddressBody, label: string, placeholder: string, extra: Record<string, unknown> = {}) => <input aria-label={label} className="field-line" value={value[key]} placeholder={placeholder} onChange={e => set({ [key]: e.target.value } as Partial<FormValue>)} {...extra}/>;
  const labelRow = (text: string, required = false) => <p className="mb-1 text-[13px] font-bold">{text}{required && <span className="ml-1.5 text-[11px] font-normal text-[var(--meta)]">· 필수</span>}</p>;

  return <div className="flex min-h-[calc(100dvh-44px)] flex-col">
    <Header title={isNew ? '새 배송지 추가' : '배송지 수정'} bare/>
    {ready && <form className="flex flex-1 flex-col" onSubmit={e => { e.preventDefault(); void submit(); }}>
      <div className="space-y-[26px]">
        <div>{labelRow('배송지명')}{input('label', '배송지명', '예: 집, 회사')}</div>
        <div>{labelRow('받는 분', true)}{input('recipientName', '받는 분', '이름을 입력해 주세요')}</div>
        <div>{labelRow('연락처', true)}{input('recipientPhone', '연락처', "'-' 없이 숫자만 입력", { type: 'tel', inputMode: 'numeric' })}</div>
        <div>{labelRow('주소', true)}
          <div className="flex items-center gap-3">{input('postalCode', '우편번호', '우편번호', { readOnly: true, onClick: openSearch })}<button type="button" onClick={openSearch} className="h-10 shrink-0 rounded-[6px] border border-[var(--border)] px-3.5 text-[12px] font-bold">주소 검색</button></div>
          <input aria-label="기본 주소" className="field-line text-[var(--aux)]!" value={value.roadAddress} placeholder="기본 주소" readOnly onClick={openSearch}/>
          {input('detailAddress', '상세 주소', '상세 주소를 입력해 주세요')}
        </div>
        <div>{labelRow('배송 요청사항')}
          <label className="relative block"><select aria-label="배송 요청사항" className={`field-line appearance-none pr-8 ${value.deliveryMemo ? '' : 'text-[var(--placeholder)]'}`} value={value.deliveryMemo} onChange={e => set({ deliveryMemo: e.target.value })}><option value="">요청사항을 선택해 주세요</option>{DELIVERY_MEMOS.map(m => <option key={m} value={m}>{m}</option>)}{value.deliveryMemo && !DELIVERY_MEMOS.includes(value.deliveryMemo) && <option value={value.deliveryMemo}>{value.deliveryMemo}</option>}</select><ChevronDown size={18} className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-[var(--muted)]"/></label>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-[6px] bg-[var(--infobar)] px-4 py-4">
          <div><p className="text-[14px] font-bold">기본 배송지로 설정</p><p className="mt-1 text-[12px] text-[var(--aux)]">주문 시 이 배송지가 자동으로 선택돼요</p></div>
          <Toggle label="기본 배송지로 설정" checked={value.makeDefault} onChange={makeDefault => set({ makeDefault })}/>
        </div>
        {isNew && <p className="text-[12px] text-[var(--meta)]">저장하면 이 화면을 연 곳(결제 또는 배송지 관리)으로 돌아가요.</p>}
        <ErrorBox message={error}/>
      </div>
      <div className="mt-auto pt-8"><button type="submit" disabled={busy} className={`flex h-12 w-full items-center justify-center rounded-[6px] text-[15px] font-bold ${valid ? 'bg-[var(--ink)] text-white' : 'bg-[var(--soft-btn)] text-[var(--placeholder)]'}`}>{busy ? '저장 중…' : '저장하기'}</button></div>
    </form>}
  </div>;
}

/* ── 주소 검색 — Figma "주소 검색", "주소 검색 결과 없음". Daum 우편번호를 화면 안에 embed ─── */
declare global { interface Window { daum?: { Postcode: new (options: Record<string, unknown>) => { embed: (el: HTMLElement, options?: Record<string, unknown>) => void } } } }
const TIPS: [string, string, string][] = [['도로명 + 건물번호', '와우산로 94', '테헤란로 152'], ['동·읍·면 + 지번', '서교동 338-1', '역삼동 737'], ['건물명·아파트명', '강남파이낸스센터', '판교 푸르지오']];
export function AddressSearchPage() {
  const navigate = useNavigate(); const [params] = useSearchParams();
  const returnTo = params.get('returnTo') || '/addresses/new';
  const [query, setQuery] = useState(''); const [searched, setSearched] = useState(''); const [count, setCount] = useState<number | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const frame = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!searched || !frame.current) return;
    const node = frame.current; node.innerHTML = '';
    if (!window.daum?.Postcode) { setUnavailable(true); return; }
    setUnavailable(false); setCount(null);
    new window.daum.Postcode({
      width: '100%', height: '100%', hideMapBtn: true, hideEngBtn: true, autoMappingRoad: true,
      onsearch: (data: { q: string; count: number }) => { setSearched(data.q); setQuery(data.q); setCount(data.count); },
      oncomplete: (data: { zonecode: string; roadAddress: string; jibunAddress: string; buildingName?: string }) => {
        sessionStorage.setItem(PICK_KEY, JSON.stringify({ postalCode: data.zonecode, roadAddress: data.roadAddress || data.jibunAddress }));
        navigate(returnTo, { replace: true });
      },
    }).embed(node, { q: searched, autoClose: false });
  }, [searched]);

  const run = (q: string) => { const v = q.trim(); if (!v) return; setQuery(v); setSearched(v); };
  const empty = !!searched && (count === 0 || unavailable);

  return <div className="space-y-4">
    <Header title="주소 검색" bare/>
    <form onSubmit={e => { e.preventDefault(); run(query); }}>
      {searched
        ? <label className="flex h-12 items-center gap-2.5 rounded-[6px] bg-[var(--soft)] px-4"><Search size={18} className="shrink-0 text-[var(--meta)]"/><input aria-label="주소 검색" value={query} onChange={e => setQuery(e.target.value)} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"/><button type="button" aria-label="검색어 지우기" onClick={() => { setQuery(''); setSearched(''); setCount(null); }}><X size={16} className="text-[var(--meta)]"/></button></label>
        : <label className="flex h-12 items-center gap-2.5 rounded-[6px] border-[1.5px] border-[var(--ink)] px-3.5"><Search size={18} className="shrink-0"/><input aria-label="주소 검색" value={query} onChange={e => setQuery(e.target.value)} placeholder="도로명, 건물명 또는 지번으로 검색" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--placeholder)]" autoFocus/></label>}
    </form>
    {!searched && <button type="button" className="flex h-11 w-full items-center justify-center gap-2 rounded-[6px] border border-[var(--border)] text-[14px] font-bold"><LocateFixed size={16}/>현재 위치로 주소 찾기</button>}
    {searched && <div ref={frame} aria-label="주소 검색 결과" className={empty ? 'hidden' : 'h-[calc(100dvh-150px)] w-full'}/>}
    {empty && <div className="space-y-8 pt-8">
      <div className="flex flex-col items-center text-center"><span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--soft)]"><MapPin size={20} className="text-[var(--meta)]"/></span><p className="mt-4 text-[15px] font-bold">'{searched}' 검색 결과가 없어요</p><p className="mt-2 px-2 text-[13px] leading-relaxed text-[var(--aux)]">결과가 없으면 띄어쓰기를 바꾸거나 건물번호를 빼고 검색해 보세요.</p></div>
      <div className="space-y-3 rounded-[6px] bg-[var(--infobar)] p-4"><p className="text-[13px] font-bold">이렇게 검색해 보세요</p>{TIPS.map(([label, example]) => <div key={label} className="flex items-center justify-between text-[12px]"><span className="text-[var(--aux)]">{label}</span><button type="button" onClick={() => run(example)}>{example}</button></div>)}</div>
    </div>}
    {!searched && <>
      <div className="-mx-4 h-2 bg-[var(--divider)]"/>
      <section className="space-y-4 pt-2">
        <p className="text-[15px] font-bold">이렇게 검색해 보세요</p>
        {TIPS.map(([label, a, b], i) => <div key={label} className={`space-y-2.5 pb-4 ${i < TIPS.length - 1 ? 'border-b border-[var(--divider)]' : ''}`}>
          <p className="text-[14px] font-bold">{label}</p>
          <div className="flex items-center gap-2"><span className="text-[12px] text-[var(--meta)]">예)</span>{[a, b].map(x => <button type="button" key={x} onClick={() => run(x)} className="rounded-[4px] bg-[var(--soft)] px-2.5 py-1 text-[12px] text-[var(--aux)]">{x}</button>)}</div>
        </div>)}
        <p className="flex items-start gap-1.5 text-[12px] text-[var(--meta)]"><Info size={14} className="mt-[2px] shrink-0"/>결과가 없으면 띄어쓰기를 바꾸거나 건물번호를 빼고 검색해 보세요.</p>
      </section>
    </>}
  </div>;
}
