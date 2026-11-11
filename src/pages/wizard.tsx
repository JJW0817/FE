import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Calendar, Check, ChevronDown, ChevronRight, Hash, Image as ImageIcon, Info, Link2, Minus, Package, Plus, ShieldCheck, Sparkles, Timer } from 'lucide-react';
import { activeUser, blankDraft, CATEGORY_PATHS, listingDimensions, listingOptions, localDateTime, lookupReference, mockAiAnalysis, money, nowOf, optionKey, publishDraft, unsupportedInput } from '../domain';
import type { Draft, Product } from '../domain';
import { atomic, getState, mutate, useStore } from '../store';
import { imageData } from '../files';
import { Button, Empty, ErrorBox, Header, Modal, Note, ProductImage, Unavailable } from '../components/ui';
import { useClock } from '../hooks';

/* ── 초안 ─────────────────────────────────────────────────────────────────────── */
const SWATCH: Record<string, string> = { 차콜: '#3F3F3F', 오트밀: '#E6DCC6', 크림: '#F3EBDC', 네이비: '#2B3A55', 블랙: '#222222', 화이트: '#FFFFFF', 내추럴: '#E8DCC8', 그레이: '#9A9A9A', 베이지: '#E3D3B8' };
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
function fromProduct(p: Product): Draft {
  const color = p.dimensions.find(d => d.name === '색상'), size = p.dimensions.find(d => d.name === '사이즈');
  const split = (v?: string) => (v ?? '').split(',').map(x => x.trim()).filter(Boolean);
  const basic = p.options.length === 1 && p.options[0].name === '기본';
  const axes = basic ? { size: false, color: false } : color || size ? { size: !!size, color: !!color } : { size: true, color: false };
  const colors = split(color?.values), sizes = size ? split(size.values) : !color && !basic ? p.options.map(o => o.name) : [];
  const stock: Record<string, number> = {};
  for (const o of p.options) { const parts = o.name.split(' / '); const c = axes.color ? parts[0] : '', s = axes.color && axes.size ? parts[1] : axes.size ? o.name : ''; stock[optionKey(basic ? '' : c, basic ? '' : s)] = o.stock; }
  return { ...blankDraft(), editingId: p.id, name: p.name, brand: p.brand, description: p.description, images: [...p.images], category: p.category, originalUrl: p.originalUrl, extras: structuredClone(p.extras), reason: p.reason, dimensions: structuredClone(p.dimensions), noOptions: basic, options: structuredClone(p.options), price: p.price, shipping: p.shipping, dispatchDays: p.dispatchDays, maxPerAccount: p.maxPerAccount, startsAt: localDateTime(p.startsAt), faqs: structuredClone(p.faqs), axes, colors, sizes, stock, reference: p.reference ?? lookupReference(p.originalUrl) };
}
function freshDraft(now: number): Draft { const start = new Date(now + 3_600_000); start.setMinutes(0, 0, 0); return { ...blankDraft(now), startsAt: localDateTime(start.getTime()), axes: { size: true, color: true }, colors: [], sizes: [], stock: {} }; }
/** 초안 변경 — options·dimensions를 항상 축·수량에서 다시 계산 */
function patchDraft(userId: string, value: Partial<Draft>) {
  mutate(state => {
    const d = state.drafts[userId] ?? freshDraft(nowOf(state));
    Object.assign(d, value);
    d.options = listingOptions(d); d.dimensions = listingDimensions(d); d.noOptions = !d.axes?.size && !d.axes?.color;
    state.drafts[userId] = d;
  });
}
/** 화면을 떠나도 계속되는 AI 분석(목업) */
const ANALYSIS_MS = 2500;
function startAnalysis(userId: string) {
  const token = Date.now().toString(36);
  patchDraft(userId, { ai: { status: 'analyzing', signature: token, category: '', reason: '' } });
  setTimeout(() => {
    const state = getState(), d = state.drafts[userId];
    if (!d || d.ai.status !== 'analyzing' || d.ai.signature !== token) return;
    const failed = state.aiOutcome === 'failed' || state.aiOutcome === 'uncertain' || !d.images.length;
    patchDraft(userId, { ai: failed ? { status: 'failed', signature: token, category: '', reason: '' } : { status: 'recommended', signature: token, category: '', reason: '', result: mockAiAnalysis(d) } });
  }, ANALYSIS_MS);
}
function useDraft() {
  const s = useStore(), user = activeUser(s); const [params] = useSearchParams(); const editId = params.get('edit');
  useEffect(() => {
    if (!user.seller) return;
    mutate(state => {
      const existing = state.drafts[user.id];
      if (editId) { if (existing?.editingId !== editId) { const p = state.products.find(p => p.id === editId && p.sellerId === user.id); if (p && nowOf(state) < p.startsAt) state.drafts[user.id] = fromProduct(p); } }
      else if (!existing || existing.editingId) state.drafts[user.id] = freshDraft(nowOf(state));
      else if (!existing.axes) state.drafts[user.id] = { ...existing, axes: { size: true, color: true }, colors: [], sizes: [], stock: {} };
    });
  }, [editId, user.id, user.seller]);
  const d = s.drafts[user.id];
  const suffix = editId ? `?edit=${encodeURIComponent(editId)}` : '';
  return { s, user, editId, d, suffix, patch: (v: Partial<Draft>) => patchDraft(user.id, v) };
}

/* ── 공통 조각 ──────────────────────────────────────────────────────────────────── */
const Label = ({ children, hint }: { children: ReactNode; hint?: string }) => <p className="text-[13px] font-bold">{children}{hint && <span className="ml-1.5 text-[11px] font-normal text-[var(--meta)]">{hint}</span>}</p>;
function Stepper({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return <div className="flex h-8 items-center rounded-[6px] border border-[var(--border)]"><button type="button" aria-label={`${label} 감소`} disabled={value <= 0} onClick={() => onChange(Math.max(0, value - 1))} className="grid h-8 w-9 place-items-center disabled:opacity-30"><Minus size={14}/></button><input aria-label={`${label} 수량`} inputMode="numeric" value={value} onChange={e => onChange(Math.max(0, Math.floor(Number(e.target.value.replace(/\D/g, '')) || 0)))} className="w-9 bg-transparent text-center text-[14px] font-bold outline-none"/><button type="button" aria-label={`${label} 증가`} onClick={() => onChange(value + 1)} className="grid h-8 w-9 place-items-center"><Plus size={14}/></button></div>;
}
function InlineAdd({ label, onAdd, className = '' }: { label: string; onAdd: (v: string) => void; className?: string }) {
  const [open, setOpen] = useState(false), [value, setValue] = useState('');
  if (!open) return <button type="button" onClick={() => setOpen(true)} className={`flex items-center gap-1 text-[13px] text-[var(--aux)] ${className}`}><Plus size={14}/>{label}</button>;
  const submit = () => { if (value.trim()) onAdd(value.trim()); setValue(''); setOpen(false); };
  return <input autoFocus aria-label={label} value={value} onChange={e => setValue(e.target.value)} onBlur={submit} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } if (e.key === 'Escape') setOpen(false); }} className={`h-9 rounded-[6px] border border-[var(--border)] px-3 text-[13px] outline-none ${className}`} placeholder={label}/>;
}
const dateLabel = (v: string) => { const t = new Date(v); return Number.isFinite(t.getTime()) ? `${t.getMonth() + 1}월 ${t.getDate()}일 (${WEEK[t.getDay()]})` : '날짜 선택'; };
const hhmm = (h: number, m: number) => `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => hhmm(Math.floor(i / 2), i % 2 * 30));

/* ── 판매 상품 등록 / 판매 정보 수정 ─────────────────────────────────────────────── */
export function WizardPage() {
  const { s, user, editId, d, suffix, patch } = useDraft(); const now = useClock(); const navigate = useNavigate(); const [params, setParams] = useSearchParams();
  const [error, setError] = useState(''), [uploading, setUploading] = useState(false), [busy, setBusy] = useState(false), [photo, setPhoto] = useState<number | null>(null), [activeColor, setActiveColor] = useState(0);
  const picking = params.get('pick') === 'category';
  if (!user.seller) return <Unavailable message="승인된 판매자만 상품을 등록할 수 있습니다."/>;
  const editing = editId ? s.products.find(p => p.id === editId && p.sellerId === user.id) : undefined;
  if (editId && (!editing || editing.startsAt <= now)) return <Empty title="판매 시작 후에는 정보를 수정할 수 없어요"><Link to="/seller/products" className="btn">상품 관리로</Link></Empty>;
  if (!d || !d.axes || (editId && d.editingId !== editId)) return null;
  const axes = d.axes, colors = d.colors ?? [], sizes = d.sizes ?? [], stock = d.stock ?? {};
  const setStock = (key: string, n: number) => patch({ stock: { ...stock, [key]: n } });
  const color = colors[Math.min(activeColor, colors.length - 1)] ?? '';
  const colorTotal = (c: string) => axes.size ? sizes.reduce((n, sz) => n + (stock[optionKey(c, sz)] ?? 0), 0) : stock[optionKey(c, '')] ?? 0;
  const total = d.options.reduce((n, o) => n + o.stock, 0);
  const blocked = unsupportedInput(d.name, d.description);
  const reference = d.reference;
  const discount = reference && d.price > 0 && d.price < reference.price ? reference.price - d.price : 0;
  const start = new Date(d.startsAt), startOk = Number.isFinite(start.getTime());
  const endLabel = startOk ? (() => { const h = start.getHours() + 3; return hhmm(h === 24 ? 24 : h % 24, start.getMinutes()); })() : '';
  const setDate = (date: string) => { if (!date) return; patch({ startsAt: `${date}T${startOk ? hhmm(start.getHours(), start.getMinutes()) : '21:00'}` }); };
  const setTime = (time: string) => patch({ startsAt: `${(startOk ? localDateTime(start.getTime()) : localDateTime(now)).slice(0, 10)}T${time}` });

  async function upload(files: FileList | null) {
    if (!files?.length) return; setUploading(true); setError('');
    try { if (d.images.length + files.length > 10) throw new Error('상품 사진은 최대 10장까지 등록할 수 있습니다.'); const added = await Promise.all([...files].map(imageData)); patch({ images: [...d.images, ...added] }); if (!d.category) startAnalysis(user.id); }
    catch (e) { setError((e as Error).message); } finally { setUploading(false); }
  }
  function openCategory() {
    if (d.ai.status === 'analyzing') navigate(`/seller/new/ai/analyzing${suffix}`);
    else if (d.ai.status === 'failed') navigate(`/seller/new/ai/failed${suffix}`);
    else if (d.ai.result) navigate(`/seller/new/ai${suffix}`);
    else if (d.images.length) { startAnalysis(user.id); navigate(`/seller/new/ai/analyzing${suffix}`); }
    else { const next = new URLSearchParams(params); next.set('pick', 'category'); setParams(next); }
  }
  const closePicker = () => { const next = new URLSearchParams(params); next.delete('pick'); setParams(next, { replace: true }); };
  async function submit() {
    setBusy(true); setError('');
    try { const product = await atomic(state => publishDraft(state, state.activeUserId, state.drafts[state.activeUserId], nowOf(state))); navigate(`/seller/published/${product.id}`, { replace: true }); }
    catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const chip = (on: boolean, label: string, onClick: () => void) => <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-[13px] ${on ? 'bg-[var(--ink)] font-bold text-white' : 'border border-[var(--border)] text-[var(--aux)]'}`}>{on && <Check size={13} strokeWidth={2.5}/>}{label}</button>;
  const qtyRow = (label: string, key: string, last: boolean) => <div key={key} className={`flex h-[52px] items-center justify-between ${last ? '' : 'border-b border-[var(--line)]'}`}><span className="text-[15px]">{label}</span><Stepper label={label} value={stock[key] ?? 0} onChange={n => setStock(key, n)}/></div>;

  return <div className="space-y-6 pb-4">
    <Header title={editId ? '판매 정보 수정' : '한정 판매 등록'} bare/>
    {editing && <div className="-mt-4 space-y-3">
      <p className="flex items-center gap-2 text-[12px] text-[var(--meta)]"><span className="rounded-[3px] bg-[var(--soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--aux)]">판매 예정</span>{`${new Date(editing.startsAt).getMonth() + 1}.${new Date(editing.startsAt).getDate()} (${WEEK[new Date(editing.startsAt).getDay()]}) ${hhmm(new Date(editing.startsAt).getHours(), new Date(editing.startsAt).getMinutes())} 오픈`}{editing.notifySubscribers !== undefined && ` · 알림 신청 ${editing.notifySubscribers}명`}</p>
      <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-3.5"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.5] text-[var(--aux)]">수정하면 판매 심사를 다시 받아요.<br/>심사 중에도 기존 정보로 오픈 일정은 유지돼요.</p></div>
    </div>}

    {/* 상품 사진 */}
    <section className="space-y-2.5">
      <Label hint="· 필수 · 최대 10장">상품 사진</Label>
      <div className="flex gap-2 overflow-x-auto">
        {d.images.length < 10 && <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[6px] border border-[var(--border)]"><Plus size={20} strokeWidth={1.5}/><span className="text-[11px] text-[var(--meta)]">{uploading ? '처리 중' : `${d.images.length}/10`}</span><input aria-label="상품 사진 업로드" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={e => { void upload(e.target.files); e.target.value = ''; }}/></label>}
        {d.images.map((src, i) => <button type="button" key={src.slice(-24) + i} onClick={() => setPhoto(i)} className="relative shrink-0"><ProductImage src={src} alt={`상품 사진 ${i + 1}`} className="h-20 w-20"/>{i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-[3px] bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">대표</span>}</button>)}
      </div>
      <p className="flex items-center gap-1.5 text-[12px] text-[var(--aux)]"><Sparkles size={14}/>사진을 올리면 AI가 카테고리를 자동으로 분류해요</p>
    </section>

    <section><Label hint="· 필수">상품명</Label><input aria-label="상품명" className="field-line" value={d.name} maxLength={50} onChange={e => patch({ name: e.target.value })} placeholder="상품명을 입력해 주세요"/></section>

    <section><Label hint="· AI 자동 분류">카테고리</Label>
      <button type="button" onClick={openCategory} className="flex h-12 w-full items-center gap-2 border-b border-[var(--line)] text-left">
        <Sparkles size={16} className="shrink-0"/>
        <span className={`min-w-0 flex-1 truncate text-[16px] ${d.category ? '' : 'text-[var(--placeholder)]'}`}>{d.category || (d.ai.status === 'analyzing' ? '사진을 분석하고 있어요' : '카테고리를 선택해 주세요')}</span>
        {(d.category || d.ai.result || d.ai.status === 'analyzing' || d.ai.status === 'failed') && <span className="flex shrink-0 items-center text-[13px] text-[var(--aux)]">분석 결과<ChevronRight size={16}/></span>}
      </button>
    </section>

    <section className="space-y-3">
      <div><Label hint="· 필수">타 플랫폼 판매 URL</Label><p className="mt-1 text-[12px] text-[var(--meta)]">쿠팡·알리 등에서 판매 중인 같은 상품의 링크</p></div>
      <label className="flex h-12 items-center gap-2 border-b border-[var(--line)]"><Link2 size={17} className="shrink-0 text-[var(--aux)]"/><input aria-label="타 플랫폼 판매 URL" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--placeholder)]" value={d.originalUrl} placeholder="https://" onChange={e => patch({ originalUrl: e.target.value, reference: lookupReference(e.target.value) })}/></label>
      {reference && <div className="flex items-center gap-3 rounded-[6px] bg-[var(--soft)] p-3">{reference.image && <ProductImage src={reference.image} alt={reference.title} className="h-12 w-12 shrink-0"/>}<div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-[var(--meta)]">{reference.platform}</p><p className="truncate text-[13px]">{reference.title}</p><p className="text-[14px] font-bold">{money(reference.price)}</p></div><span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[var(--positive)]"><Check size={14}/>확인됨</span></div>}
      {(d.extraUrls ?? []).map((url, i) => <label key={i} className="flex h-12 items-center gap-2 border-b border-[var(--line)]"><Link2 size={17} className="shrink-0 text-[var(--aux)]"/><input aria-label={`추가 URL ${i + 1}`} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" value={url} placeholder="https://" onChange={e => patch({ extraUrls: (d.extraUrls ?? []).map((u, j) => j === i ? e.target.value : u) })}/></label>)}
      <button type="button" onClick={() => patch({ extraUrls: [...(d.extraUrls ?? []), ''] })} className="flex items-center gap-1 text-[13px] text-[var(--aux)]"><Plus size={14}/>다른 플랫폼 URL 추가</button>
    </section>

    <section className="space-y-2.5"><Label hint="· 필수">한정 판매가</Label>
      <label className="flex h-12 items-center border-b border-[var(--line)]"><input aria-label="한정 판매가" inputMode="numeric" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--placeholder)]" value={d.price ? d.price.toLocaleString('ko-KR') : ''} placeholder="0" onChange={e => patch({ price: Number(e.target.value.replace(/\D/g, '')) || 0 })}/><span className="text-[14px] text-[var(--aux)]">원</span></label>
      {discount > 0 && reference && <p className="flex items-center gap-2 text-[12px] text-[var(--aux)]"><span className="rounded-[3px] bg-[var(--positive-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--positive)]">{Math.round(discount / reference.price * 100)}% 저렴</span>{`${reference.platform} 판매가보다 ${money(discount)} 저렴해요`}</p>}
      <p className="text-[12px] text-[var(--meta)]">등록한 URL의 판매가보다 낮아야 심사를 요청할 수 있어요</p>
    </section>

    <section className="space-y-3"><Label hint="· 필수">옵션별 한정 수량</Label>
      <div className="flex items-center gap-2"><span className="mr-1 text-[12px] text-[var(--aux)]">옵션</span>{chip(axes.size, '사이즈', () => patch({ axes: { ...axes, size: !axes.size } }))}{chip(axes.color, '색상', () => patch({ axes: { ...axes, color: !axes.color } }))}{chip(!axes.size && !axes.color, '옵션 없음', () => patch({ axes: { size: false, color: false } }))}</div>
      {axes.color && <div className="flex flex-wrap gap-2">{colors.map((c, i) => <button type="button" key={c} onClick={() => setActiveColor(i)} className={`flex h-10 items-center gap-1.5 rounded-[6px] px-3.5 ${c === color ? 'border-[1.5px] border-[var(--ink)]' : 'border border-[var(--border)]'}`}><span className="h-3.5 w-3.5 rounded-full border border-black/10" style={{ background: SWATCH[c] ?? '#DEDEDE' }}/><span className={`text-[14px] ${c === color ? 'font-bold' : 'text-[var(--aux)]'}`}>{c}</span><span className="text-[12px] text-[var(--meta)]">{colorTotal(c)}개</span></button>)}<InlineAdd label="색상" className="h-10 rounded-[6px] border border-[var(--border)] px-3.5" onAdd={v => { if (!colors.includes(v)) { patch({ colors: [...colors, v] }); setActiveColor(colors.length); } }}/></div>}
      {(axes.size || (!axes.color && !axes.size) || (axes.color && color)) && <div className="rounded-[6px] border border-[var(--line)] px-4">
        {axes.size ? <>
          <div className="flex h-12 items-center justify-between border-b border-[var(--line)]"><p className="text-[13px] font-bold">{axes.color ? `${color || '색상'} · 사이즈별 수량` : '사이즈별 수량'}</p><p className="text-[13px] font-bold text-[var(--aux)]">{axes.color ? colorTotal(color) : total}개</p></div>
          {sizes.map((sz, i) => qtyRow(sz, optionKey(axes.color ? color : '', sz), i === sizes.length - 1))}
          <div className="border-t border-[var(--line)] py-3.5"><InlineAdd label="사이즈 추가" onAdd={v => { if (!sizes.includes(v)) patch({ sizes: [...sizes, v] }); }}/></div>
        </> : axes.color ? qtyRow(`${color} 수량`, optionKey(color, ''), true) : qtyRow('기본 수량', optionKey('', ''), true)}
      </div>}
      <div className="flex items-center justify-between rounded-[6px] bg-[var(--soft)] px-4 py-3.5"><div><p className="text-[13px] font-bold">총 한정 수량</p>{axes.color && colors.length > 0 && <p className="mt-0.5 text-[12px] text-[var(--meta)]">{colors.map(c => `${c} ${colorTotal(c)}`).join(' · ')}</p>}</div><p className="text-[18px] font-bold">{total}개</p></div>
      <p className="text-[12px] text-[var(--meta)]">판매가 시작되면 옵션과 수량을 바꿀 수 없어요{editing ? ` · 1인 ${d.maxPerAccount}개 구매` : ''}</p>
    </section>

    <section className="space-y-3"><Label hint="· 필수">판매 일정</Label>
      <div className="flex gap-4">
        <label className="relative flex h-12 min-w-0 flex-[1.6] items-center justify-between border-b border-[var(--line)]"><span className="text-[16px]">{startOk ? dateLabel(d.startsAt) : '날짜 선택'}</span><Calendar size={18} className="text-[var(--aux)]"/><input aria-label="판매 날짜" type="date" className="absolute inset-0 opacity-0" min={localDateTime(now).slice(0, 10)} max={localDateTime(now + 7 * 86_400_000).slice(0, 10)} value={startOk ? localDateTime(start.getTime()).slice(0, 10) : ''} onChange={e => setDate(e.target.value)}/></label>
        <label className="relative flex h-12 min-w-0 flex-1 items-center justify-between border-b border-[var(--line)]"><span className="text-[16px]">{startOk ? hhmm(start.getHours(), start.getMinutes()) : '시간'}</span><ChevronDown size={18} className="text-[var(--aux)]"/><select aria-label="판매 시작 시각" className="absolute inset-0 opacity-0" value={startOk ? hhmm(start.getHours(), start.getMinutes()) : ''} onChange={e => setTime(e.target.value)}>{TIME_SLOTS.map(t => <option key={t}>{t}</option>)}</select></label>
      </div>
      {startOk && <p className="flex items-center gap-2 rounded-[6px] bg-[var(--soft)] px-4 py-3 text-[13px] font-bold"><Timer size={16}/>{`${hhmm(start.getHours(), start.getMinutes())} – ${endLabel} · 3시간 동안 선착순 판매`}</p>}
    </section>

    <section className="space-y-3"><Label hint="· 필수">출고 기한</Label>
      <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(n => <button type="button" key={n} onClick={() => patch({ dispatchDays: n })} className={`h-10 rounded-[6px] text-[13px] ${d.dispatchDays === n ? 'bg-[var(--ink)] font-bold text-white' : 'border border-[var(--border)] text-[var(--aux)]'}`}>{n}영업일</button>)}</div>
    </section>

    {!editId && <section className="space-y-3">
      <div><Label hint="· 운영팀 진행">물품 검수</Label><p className="mt-1 text-[12px] text-[var(--aux)]">판매 심사 때 운영팀이 실제 상품을 직접 확인해요</p></div>
      <div className="space-y-3 rounded-[6px] bg-[var(--soft)] p-4">
        {([[ShieldCheck, '정품 여부', '브랜드 정품인지 확인해요'], [ImageIcon, '상품 상태', '등록 사진과 실제 상태가 같은지 봐요'], [Package, '구성품', '설명서·보증서 등 빠진 게 없는지 봐요'], [Hash, '수량', '옵션별 한정 수량과 맞는지 세어요']] as const).map(([Icon, title, desc]) => <div key={title} className="flex items-center gap-2.5"><Icon size={16} className="shrink-0"/><span className="w-[60px] shrink-0 text-[13px] font-bold">{title}</span><span className="text-[12px] text-[var(--aux)]">{desc}</span></div>)}
        <p className="flex items-start gap-1.5 border-t border-[var(--line)] pt-3 text-[12px] text-[var(--meta)]"><Info size={14} className="mt-[2px] shrink-0"/>미통과 시 알림으로 사유를 알려드리고 재등록할 수 있어요.</p>
      </div>
    </section>}

    {blocked && <ErrorBox message="지원하지 않는 상품은 등록할 수 없습니다."/>}
    <ErrorBox message={error}/>
    <div className="space-y-3 pt-4">
      <p className="text-center text-[12px] text-[var(--meta)]">{editId ? '수정 내용은 판매 심사 후 반영돼요 · 영업일 기준 1일 이내' : '판매 심사와 물품 검수는 영업일 기준 1일 이내에 완료돼요'}</p>
      <Button className="w-full text-[15px]!" disabled={busy || uploading || blocked} onClick={submit}>{busy ? '요청 중…' : editId ? '수정 내용 저장' : '판매 심사 요청하기'}</Button>
    </div>

    {photo !== null && d.images[photo] && <Modal title={`상품 사진 ${photo + 1}`} onClose={() => setPhoto(null)}><div className="space-y-3"><ProductImage src={d.images[photo]} alt="선택한 사진" className="aspect-square w-full"/>{photo > 0 && <Button className="w-full" onClick={() => { patch({ images: [d.images[photo], ...d.images.filter((_, j) => j !== photo)] }); setPhoto(null); }}>대표 사진으로 지정</Button>}<Button outline className="w-full" onClick={() => { patch({ images: d.images.filter((_, j) => j !== photo) }); setPhoto(null); }}>삭제</Button></div></Modal>}
    {picking && <CategoryPicker value={d.category} onClose={closePicker} onSave={category => { patch({ category }); closePicker(); }}/>}
  </div>;
}
function CategoryPicker({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [pick, setPick] = useState(value);
  return <Modal title="카테고리 선택" onClose={onClose}><div className="space-y-1">{CATEGORY_PATHS.map(path => <label key={path} className="divider flex items-center gap-3 py-3 text-[13px]"><input type="radio" name="category" value={path} checked={pick === path} onChange={() => setPick(path)}/>{path}</label>)}<Note>지원 목록에서만 선택할 수 있습니다. 등록 대상이 아닌 상품은 다른 카테고리로 우회 등록할 수 없습니다.</Note><Button className="mt-4 w-full" disabled={!pick} onClick={() => onSave(pick)}>카테고리 저장</Button></div></Modal>;
}

/* ── AI 상품 분석 (결과 / 분석 중 / 실패와 재시도) ─────────────────────────────────── */
function AiFrame({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return <div className="flex min-h-[calc(100dvh-44px)] flex-col"><Header title="AI 상품 분석" bare/><div className="flex-1 space-y-5">{children}</div><div className="pt-8">{footer}</div></div>;
}
function Thumbs({ images }: { images: string[] }) { return <div className="flex gap-2">{(images.length ? images.slice(0, 4) : ['', '']).map((src, i) => <div key={i} className="h-[72px] w-[72px] rounded-[4px] bg-[var(--soft)]" aria-hidden={!src}/>)}</div>; }

export function AiAnalysisPage() {
  const { user, d, suffix, patch } = useDraft(); const navigate = useNavigate(); const [pick, setPick] = useState<string>('');
  if (!user.seller) return <Unavailable message="승인된 판매자만 상품을 등록할 수 있습니다."/>;
  if (!d) return null;
  if (d.ai.status === 'analyzing') return <Navigate to={`/seller/new/ai/analyzing${suffix}`} replace/>;
  if (d.ai.status === 'failed' || !d.ai.result) return <Navigate to={`/seller/new/ai/failed${suffix}`} replace/>;
  const r = d.ai.result, chosen = pick || r.path;
  const back = () => navigate(`/seller/new${suffix}`);
  return <AiFrame footer={<div className="flex gap-2"><Button outline className="w-[128px] text-[15px]!" onClick={() => { startAnalysis(user.id); navigate(`/seller/new/ai/analyzing${suffix}`, { replace: true }); }}>다시 분석</Button><Button className="flex-1 text-[15px]!" onClick={() => { patch({ category: chosen }); back(); }}>이 카테고리로 적용</Button></div>}>
    <div className="space-y-2"><div className="relative"><ProductImage src={d.images[0]} alt="분석한 대표 사진" className="h-[240px] w-full"/><span className="absolute left-3 top-3 flex items-center gap-1 rounded-[4px] bg-black/70 px-2 py-1 text-[11px] font-bold text-white"><Sparkles size={12}/>AI 분석 완료</span></div><p className="text-[12px] text-[var(--meta)]">등록한 사진 {r.photos}장을 분석했어요</p></div>
    <button type="button" onClick={() => setPick(r.path)} className="block w-full space-y-2 text-left">
      <p className="text-[12px] font-bold text-[var(--meta)]">AI 추천 카테고리</p>
      <div className="flex items-end justify-between"><div><p className="text-[22px] font-bold">{r.category}</p><p className="mt-1 text-[13px] text-[var(--aux)]">{r.path}</p></div><div className="text-right"><p className="text-[16px] font-bold">{r.confidence}%</p><p className="text-[11px] text-[var(--meta)]">일치도</p></div></div>
      <div className="h-1 w-full rounded-full bg-[var(--line)]"><div className="h-1 rounded-full bg-[var(--positive)]" style={{ width: `${r.confidence}%` }}/></div>
    </button>
    <div className="-mx-4 h-2 bg-[var(--divider)]"/>
    <section className="space-y-4"><h2 className="text-[16px] font-bold">사진에서 찾은 정보</h2>{r.found.map(([k, v]) => <div key={k} className="flex justify-between text-[13px]"><span className="text-[var(--aux)]">{k}</span><span>{v}</span></div>)}</section>
    <section className="pt-2"><h2 className="mb-2 text-[16px] font-bold">다른 추천 카테고리</h2>{r.alternatives.map(([path, pct]) => <label key={path} className="flex h-12 cursor-pointer items-center gap-3 border-b border-[var(--line)]"><input type="radio" name="ai-category" className="peer sr-only" checked={chosen === path} onChange={() => setPick(path)}/><span className={`grid h-5 w-5 place-items-center rounded-full border-[1.5px] ${chosen === path ? 'border-[var(--ink)]' : 'border-[var(--border)]'}`}>{chosen === path && <span className="h-2.5 w-2.5 rounded-full bg-[var(--ink)]"/>}</span><span className="flex-1 text-[14px]">{path}</span><span className="text-[13px] text-[var(--meta)]">{pct}%</span></label>)}</section>
    <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-4"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.5] text-[var(--aux)]">AI 분석 결과는 판매 심사에서 한 번 더 확인해요.<br/>카테고리가 다르면 다른 추천 중에서 골라주세요.</p></div>
  </AiFrame>;
}

export function AiAnalyzingPage() {
  const { user, d, suffix } = useDraft(); const navigate = useNavigate();
  useEffect(() => { if (d && d.ai.status !== 'analyzing') navigate(`/seller/new/ai${d.ai.status === 'failed' ? '/failed' : ''}${suffix}`, { replace: true }); }, [d?.ai.status]);
  if (!user.seller) return <Unavailable message="승인된 판매자만 상품을 등록할 수 있습니다."/>;
  if (!d) return null;
  return <AiFrame footer={<Button outline className="w-full text-[15px]!" onClick={() => navigate(`/seller/new${suffix}`)}>기다리지 않고 등록 계속하기</Button>}>
    <Thumbs images={d.images}/>
    <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--soft)]"><Sparkles size={18}/></span>
    <div className="space-y-3"><h1 className="text-[24px] font-bold leading-[1.45] tracking-[-.7px]">등록한 사진 {d.images.length}장을<br/>분석하고 있어요</h1><p className="text-[13px] text-[var(--aux)]">보통 10초 안에 끝나요.</p></div>
    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--line)]"><div className="h-1 w-[60%] rounded-full bg-[var(--ink)]"/></div>
    <div className="space-y-3.5">{([['카테고리', 60], ['색상', 38], ['소재', 49], ['핏', 33]] as const).map(([label, w]) => <div key={label} className="flex items-center justify-between"><span className="text-[12px] text-[var(--muted)]">{label}</span><span className="h-3 rounded-[2px] bg-[var(--soft)]" style={{ width: `${w}%` }}/></div>)}</div>
    <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-4"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.6] text-[var(--aux)]">분석을 기다리지 않아도 돼요. 상품 등록은 계속 진행할 수 있고, 결과는 확인한 뒤에만 반영돼요.</p></div>
  </AiFrame>;
}

export function AiFailedPage() {
  const { user, d, suffix } = useDraft(); const navigate = useNavigate();
  if (!user.seller) return <Unavailable message="승인된 판매자만 상품을 등록할 수 있습니다."/>;
  if (!d) return null;
  return <AiFrame footer={<div className="flex gap-2"><Button outline className="w-[128px] text-[15px]!" onClick={() => navigate(`/seller/new${suffix}${suffix ? '&' : '?'}pick=category`, { replace: true })}>직접 입력하기</Button><Button className="flex-1 text-[15px]!" onClick={() => { startAnalysis(user.id); navigate(`/seller/new/ai/analyzing${suffix}`, { replace: true }); }}>다시 분석</Button></div>}>
    <Thumbs images={d.images}/>
    <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--red-soft)]"><AlertCircle size={18} className="text-[var(--action)]"/></span>
    <div className="space-y-2"><h1 className="text-[24px] font-bold tracking-[-.7px]">사진을 분석하지 못했어요</h1><p className="text-[13px] text-[var(--aux)]">사진이 흐리거나 상품이 잘 보이지 않으면 분석이 어려워요.</p></div>
    <div className="space-y-2 rounded-[6px] bg-[var(--infobar)] p-4"><p className="text-[13px] font-bold">이렇게 하면 더 잘 분석돼요</p><p className="whitespace-pre-line text-[12px] leading-[1.7] text-[var(--aux)]">{'· 상품 전체가 보이도록 밝은 곳에서 촬영\n· 라벨·택이 보이는 사진을 함께 등록\n· 한 사진에 상품 하나만'}</p></div>
    <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-4"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.6] text-[var(--aux)]">AI 분석 없이 카테고리를 직접 선택해도 판매 심사를 요청할 수 있어요. 입력한 내용은 그대로 저장돼 있어요.</p></div>
  </AiFrame>;
}
