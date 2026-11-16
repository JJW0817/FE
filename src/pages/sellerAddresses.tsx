/**
 * 판매자 출고지·반품지 주소록(실제 모드) — /sellers/me/address-book/{DISPATCH|RETURN} 조회·추가·수정·삭제·기본 지정.
 * 기본 주소 변경은 서버가 판매자 프로필(sellers/me)에 동기화한다. mock 모드는 seller.tsx의 Figma 목업 화면을 그대로 쓴다.
 */
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, ErrorBox, Field, Header, LiveStatus, Modal } from '../components/ui';
import { createAddressBook, deleteAddressBook, errorMessage, fieldErrors, isApiError, listAddressBook, setDefaultAddressBook, updateAddressBook, useApi } from '../api';
import type { AddressBookBody, AddressType, SellerAddressBookDto } from '../api';
import { takeAddressPick } from './address';

const LABEL: Record<AddressType, string> = { DISPATCH: '출고지', RETURN: '반품지' };
const line = (a: SellerAddressBookDto) => `${a.address.roadAddress}${a.address.detailAddress ? `, ${a.address.detailAddress}` : ''} (${a.address.postalCode})`;
const typeOf = (v: string | null, fallback: AddressType): AddressType => (v === 'DISPATCH' || v === 'RETURN' ? v : fallback);

/** 출고지 · 반품지 관리: 탭별 목록, 기본 지정, 수정, 삭제(기본 주소는 다른 주소를 기본으로 지정한 뒤) */
export function AddressBookPage() {
  const [params, setParams] = useSearchParams(); const navigate = useNavigate();
  const tab = typeOf(params.get('tab'), 'DISPATCH');
  const list = useApi(signal => listAddressBook(tab, signal), [tab]);
  const [error, setError] = useState(''), [busy, setBusy] = useState(''), [removing, setRemoving] = useState<SellerAddressBookDto | null>(null);
  async function run(id: string, f: () => Promise<unknown>) {
    setBusy(id); setError('');
    try { await f(); list.reload(); } catch (e) { setError(isApiError(e, 'SELLER_DEFAULT_ADDRESS_REQUIRED') ? '기본 주소는 삭제할 수 없어요. 다른 주소를 기본으로 지정한 뒤 삭제해 주세요.' : errorMessage(e)); } finally { setBusy(''); }
  }
  const items = [...(list.data ?? [])].sort((a, b) => Number(b.defaultAddress) - Number(a.defaultAddress));
  return <div>
    <Header title="출고지 · 반품지 관리"/>
    <p className="muted mb-4 text-[12px] leading-relaxed">기본 출고지·반품지는 새로 등록하는 상품에 자동으로 지정돼요.<br/>상품 등록 화면에서 다른 주소를 고를 수도 있어요.</p>
    <div className="mb-4 flex border-b border-[var(--line)]">
      {(['DISPATCH', 'RETURN'] as const).map(t => <button key={t} type="button" onClick={() => setParams({ tab: t }, { replace: true })} className={`flex-1 border-b-2 py-3 text-[13px] font-bold ${tab === t ? 'border-[var(--ink)]' : 'muted border-transparent'}`}>{LABEL[t]}{tab === t && list.data ? ` ${list.data.length}` : ''}</button>)}
    </div>
    <div className="space-y-3">
      <LiveStatus state={list}/>
      <ErrorBox message={error}/>
      {list.data && !items.length && <p className="muted py-6 text-center text-[13px]">등록된 {LABEL[tab]}가 없어요</p>}
      {items.map(a => <div key={a.id} className="space-y-2 rounded-[8px] border border-[var(--line)] p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2"><p className="truncate text-[14px] font-bold">{a.label}</p>{a.defaultAddress && <span className="shrink-0 rounded-full bg-[var(--canvas)] px-2 py-0.5 text-[10px] font-bold">기본</span>}</div>
          <div className="flex shrink-0 gap-3">
            {!a.defaultAddress && <button type="button" disabled={!!busy} onClick={() => void run(a.id, () => setDefaultAddressBook(tab, a.id))} className="muted text-[12px]">기본 설정</button>}
            <Link to={`/seller/settings/ship-edit?type=${tab}&id=${encodeURIComponent(a.id)}`} className="text-[12px] font-bold">수정</Link>
            {!a.defaultAddress && <button type="button" disabled={!!busy} onClick={() => setRemoving(a)} className="text-[12px] text-[var(--red)]">삭제</button>}
          </div>
        </div>
        <p className="muted text-[12px]">{line(a)}</p>
        <p className="muted text-[12px]">{a.contactName} · {a.contactPhone}</p>
      </div>)}
      <Button outline className="w-full" onClick={() => navigate(`/seller/settings/ship-edit?type=${tab}`)}>{LABEL[tab]} 추가</Button>
    </div>
    {removing && <Modal title={`${LABEL[tab]}를 삭제할까요?`} onClose={() => setRemoving(null)}><div className="space-y-4">
      <div className="space-y-1 rounded-[4px] bg-[var(--canvas)] p-3"><p className="text-[13px] font-bold">{removing.label}</p><p className="muted text-[12px]">{line(removing)}</p></div>
      <div className="flex gap-2"><Button outline className="flex-1" onClick={() => setRemoving(null)}>취소</Button><Button className="flex-1" disabled={!!busy} onClick={() => { const a = removing; setRemoving(null); void run(a.id, () => deleteAddressBook(tab, a.id)); }}>삭제</Button></div>
    </div></Modal>}
  </div>;
}

/** 주소 검색 화면을 다녀오는 동안 입력 중인 값을 잃지 않게 보관한다 */
const FORM_KEY = 'stockdrop:seller-address-form';
type Form = AddressBookBody & { makeDefault: boolean };
const blank: Form = { label: '', contactName: '', contactPhone: '', address: { postalCode: '', roadAddress: '', detailAddress: '' }, makeDefault: false };
/** 입력 검사(서버 규칙: 이름 ≤50, 담당자 ≤100, 우편번호 5자리, 도로명 ≤200) */
export function addressFormProblems(f: AddressBookBody): Record<string, string> {
  const e: Record<string, string> = {};
  if (!f.label.trim()) e.label = '이름을 입력해 주세요.'; else if (f.label.trim().length > 50) e.label = '이름은 50자까지 입력할 수 있어요.';
  if (!f.contactName.trim()) e.contactName = '담당자 이름을 입력해 주세요.'; else if (f.contactName.trim().length > 100) e.contactName = '담당자 이름은 100자까지 입력할 수 있어요.';
  if (!/^[0-9-]{9,13}$/.test(f.contactPhone.trim())) e.contactPhone = '연락처를 숫자로 입력해 주세요.';
  if (!/^\d{5}$/.test(f.address.postalCode) || !f.address.roadAddress.trim()) e.address = '주소 검색으로 주소를 선택해 주세요.';
  return e;
}

/** 출고지·반품지 추가/수정 (/seller/settings/ship-edit?type=DISPATCH|RETURN&id=) */
export function AddressBookFormPage({ fallback }: { fallback: AddressType }) {
  const [params] = useSearchParams(); const navigate = useNavigate();
  const type = typeOf(params.get('type'), fallback), id = params.get('id');
  const here = `/seller/settings/ship-edit?type=${type}${id ? `&id=${encodeURIComponent(id)}` : ''}`;
  const [form, setForm] = useState<Form>(blank), [ready, setReady] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({}), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  // 수정: 기존 값, 추가: 빈 값. 주소 검색에서 돌아왔으면 보관한 입력 + 고른 주소
  const current = useApi(async signal => (id ? (await listAddressBook(type, signal)).find(a => a.id === id) ?? null : null), [type, id]);
  const dispatch = useApi(async signal => (type === 'RETURN' ? listAddressBook('DISPATCH', signal) : []), [type]);
  useEffect(() => {
    if (ready || current.loading) return;
    let base: Form = current.data ? { label: current.data.label, contactName: current.data.contactName, contactPhone: current.data.contactPhone, address: { ...current.data.address, detailAddress: current.data.address.detailAddress ?? '' }, makeDefault: current.data.defaultAddress } : blank;
    try { const saved = JSON.parse(sessionStorage.getItem(FORM_KEY) || 'null'); if (saved?.here === here) base = saved.form; sessionStorage.removeItem(FORM_KEY); } catch { /* 보관 값 없음 */ }
    const pick = takeAddressPick(); if (pick) base = { ...base, address: { ...base.address, postalCode: pick.postalCode, roadAddress: pick.roadAddress } };
    setForm(base); setReady(true);
  }, [current.loading, current.data, ready, here]);
  const set = (v: Partial<Form>) => setForm(f => ({ ...f, ...v }));
  const setAddr = (v: Partial<Form['address']>) => setForm(f => ({ ...f, address: { ...f.address, ...v } }));
  const search = () => { sessionStorage.setItem(FORM_KEY, JSON.stringify({ here, form })); navigate(`/address-search?returnTo=${encodeURIComponent(here)}`); };
  const defaultDispatch = dispatch.data?.find(a => a.defaultAddress);

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError('');
    const problems = addressFormProblems(form); setErrors(problems);
    if (Object.keys(problems).length) return;
    const body: AddressBookBody = { label: form.label.trim(), contactName: form.contactName.trim(), contactPhone: form.contactPhone.trim(), address: { postalCode: form.address.postalCode, roadAddress: form.address.roadAddress.trim(), detailAddress: form.address.detailAddress?.trim() || null } };
    setBusy(true);
    try {
      const saved = id ? await updateAddressBook(type, id, body) : await createAddressBook(type, body);
      if (form.makeDefault && !saved.defaultAddress) await setDefaultAddressBook(type, saved.id);
      navigate(`/seller/settings/addresses?tab=${type}`, { replace: true });
    } catch (err) { setErrors(fieldErrors(err)); setError(errorMessage(err)); } finally { setBusy(false); }
  }

  if (id && !current.loading && !current.error && !current.data) return <><Header title={`${LABEL[type]} 수정`}/><ErrorBox message="주소를 찾을 수 없어요. 목록에서 다시 선택해 주세요."/></>;
  return <form className="space-y-5" onSubmit={save}>
    <Header title={`${LABEL[type]} ${id ? '수정' : '추가'}`}/>
    <LiveStatus state={current}/>
    {type === 'RETURN' && defaultDispatch && <button type="button" onClick={() => setForm(f => ({ ...f, address: { ...defaultDispatch.address, detailAddress: defaultDispatch.address.detailAddress ?? '' }, contactName: f.contactName || defaultDispatch.contactName, contactPhone: f.contactPhone || defaultDispatch.contactPhone }))} className="w-full rounded-[8px] bg-[var(--canvas)] p-3 text-left"><p className="text-[13px] font-bold">기본 출고지 주소 불러오기</p><p className="muted text-[11px]">{defaultDispatch.label} · {line(defaultDispatch)}</p></button>}
    <Field label={`${LABEL[type]} 이름`} required error={errors.label}><input aria-label={`${LABEL[type]} 이름`} className="field" maxLength={50} value={form.label} onChange={e => set({ label: e.target.value })} placeholder={type === 'DISPATCH' ? '예: 성수 물류창고' : '예: 반품 센터'}/></Field>
    <Field label="담당자" required error={errors.contactName}><input aria-label="담당자" className="field" maxLength={100} value={form.contactName} onChange={e => set({ contactName: e.target.value })}/></Field>
    <Field label="연락처" required error={errors.contactPhone}><input aria-label="연락처" className="field" type="tel" inputMode="tel" value={form.contactPhone} onChange={e => set({ contactPhone: e.target.value })} placeholder="010-0000-0000"/></Field>
    <Field label="주소" required error={errors.address ?? errors['address.postalCode'] ?? errors['address.roadAddress']}>
      <div className="space-y-2">
        <div className="flex gap-2"><input aria-label="우편번호" className="field flex-1" value={form.address.postalCode} readOnly placeholder="우편번호"/><Button outline className="shrink-0 text-[12px]!" onClick={search}>주소 검색</Button></div>
        <input aria-label="도로명 주소" className="field" value={form.address.roadAddress} readOnly placeholder="주소 검색으로 선택해 주세요"/>
        <input aria-label="상세 주소" className="field" maxLength={200} value={form.address.detailAddress ?? ''} onChange={e => setAddr({ detailAddress: e.target.value })} placeholder="상세 주소(선택)"/>
      </div>
    </Field>
    {!(id && current.data?.defaultAddress) && <label className="flex items-center gap-3"><input type="checkbox" className="h-4 w-4" checked={form.makeDefault} onChange={e => set({ makeDefault: e.target.checked })}/><div><p className="text-[13px] font-bold">기본 {LABEL[type]}로 설정</p><p className="muted text-[11px]">새로 등록하는 상품의 {LABEL[type]}로 자동 지정돼요</p></div></label>}
    <ErrorBox message={error}/>
    <Button type="submit" className="w-full" disabled={busy || !ready}>{busy ? '저장 중…' : '저장하기'}</Button>
  </form>;
}
