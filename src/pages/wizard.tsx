import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, Calendar, Check, ChevronDown, ChevronRight, Hash, Image as ImageIcon, Info, Link2, Minus, Package, Plus, ShieldCheck, Sparkles, Timer } from 'lucide-react';
import { activeUser, blankDraft, listingDimensions, listingOptions, localDateTime, lookupReference, mockAiAnalysis, money, nowOf, optionKey, publishDraft, unsupportedInput } from '../domain';
import type { AiQuestion, Draft, Product } from '../domain';
import type { RegistrationMetadataDto } from '../api/types';
import { atomic, getState, mutate, useStore } from '../store';
import { imageData } from '../files';
import { Button, Empty, ErrorBox, Header, LiveStatus, Modal, Note, ProductImage, Unavailable, useToast } from '../components/ui';
import { useClock } from '../hooks';
import { USE_MOCK } from '../config';
import { MOCK_REGISTRATION_METADATA, PRODUCT_STATE_MESSAGE, SHIPPING_NOTICE_MAX, ATTRIBUTE_VALUE_MAX, attributeName, composeShippingNotice, warnCriteria, analysisProblems, analyzeDraft, categoriesForCode, criteriaFor, listAddressBook, listingProblems, createProductDraft, deleteProductImage, errorMessage, fieldErrors, isApiError, getRegistrationMetadata, getSellerProductWithImages, mergeProducts, reorderProductImages, submitListing, submitRevisionFromDraft, uploadProductImage, useApi, useLive } from '../api';

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
  return { ...blankDraft(), editingId: p.id, name: p.name, brand: p.brand, description: p.description, images: [...p.images], imageIds: p.imageIds && [...p.imageIds], imageSizes: p.imageSizes && [...p.imageSizes], category: p.category, originalUrl: p.originalUrl, extras: structuredClone(p.extras), reason: p.reason, dimensions: structuredClone(p.dimensions), noOptions: basic, options: structuredClone(p.options), price: p.price, shipping: p.shipping, shippingNotice: p.shippingNotice ?? '', dispatchDays: p.dispatchDays, maxPerAccount: p.maxPerAccount, startsAt: p.startsAt ? localDateTime(p.startsAt) : blankDraft().startsAt, faqs: structuredClone(p.faqs), axes, colors, sizes, stock, reference: p.reference ?? lookupReference(p.originalUrl) };
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
/**
 * 수정할 수 없는 이유(null = 수정 가능). 실제 API는 서버 status로 판단: DRAFT·REJECTED는 항상(반려 → 수정 → 재심사 요청),
 * APPROVED는 판매 시작(startsAt, UTC epoch) 전만 수정 심사, IN_REVIEW는 불가. mock은 판매 시작 전.
 */
export function editBlocker(p: Pick<Product, 'reviewStatus' | 'startsAt'>, now: number): string | null {
  switch (p.reviewStatus) {
    case 'DRAFT': case 'REJECTED': return null;
    case 'IN_REVIEW': return '심사 중에는 정보를 수정할 수 없어요';
    case 'APPROVED': return now < p.startsAt ? null : '판매 시작 후에는 정보를 수정할 수 없어요';
    case undefined: return now < p.startsAt ? null : '판매 시작 후에는 정보를 수정할 수 없어요';
    default: return '지금은 정보를 수정할 수 없어요';
  }
}
const canEdit = (p: Product, now: number) => !editBlocker(p, now);
/** 실제 모드: 서버 초안 상품이 없으면 만든다(사진 업로드·AI 분석 전에 상품 id가 필요) */
const creating = new Map<string, Promise<string>>();
async function ensureServerDraft(userId: string): Promise<string> {
  const d = getState().drafts[userId], id = d?.editingId ?? d?.serverId;
  if (id) return id;
  // 사진 업로드와 분석이 겹쳐도 초안은 하나만 만든다
  const running = creating.get(userId); if (running) return running;
  const p = createProductDraft().then(x => { patchDraft(userId, { serverId: x.id }); return x.id; }).finally(() => creating.delete(userId));
  creating.set(userId, p); return p;
}
/** 등록 메타데이터(허용 카테고리·점검 기준). 한 번 받아 두고 같이 쓴다. mock은 같은 모양의 목업 */
let metaCache: Promise<RegistrationMetadataDto> | undefined;
const loadMeta = () => (metaCache ??= (USE_MOCK ? Promise.resolve(MOCK_REGISTRATION_METADATA) : getRegistrationMetadata().then(m => { warnCriteria(m); return m; })).catch(e => { metaCache = undefined; throw e; }));
export const useRegistrationMeta = () => useApi(() => loadMeta(), []);

export const AI_MESSAGES = {
  NOT_APPLICABLE: '판매 가능한 분류(의류·패션잡화·문구·생활잡화)에 속하지 않는 상품으로 보여요. 사진을 바꾸거나 카테고리를 직접 선택해 주세요',
  UNCLEAR: '사진이 선명하지 않아 판단하지 못했어요. 상품이 잘 보이는 사진으로 바꿔 주세요',
  NO_CATEGORY: 'AI가 추천한 분류를 등록 카테고리에서 찾지 못했어요. 카테고리를 직접 선택해 주세요',
};
/** 분석 결과(outcome) → 초안 AI 상태. NOT_APPLICABLE·UNCLEAR는 실패가 아니라 안내(등록 화면 카테고리 칸 위에 표시) */
export function aiStateOf(token: string, r: { outcome: string; code: string; category: string; questions: AiQuestion[] }, photos: number): Draft['ai'] {
  const base = { signature: token, category: '', reason: '' };
  if (r.outcome === 'RECOMMENDED' && r.category) return { ...base, status: 'recommended', result: { code: r.code, category: r.category, photos, questions: r.questions } };
  return { ...base, status: 'uncertain', reason: r.outcome === 'NOT_APPLICABLE' ? AI_MESSAGES.NOT_APPLICABLE : r.outcome === 'UNCLEAR' ? AI_MESSAGES.UNCLEAR : AI_MESSAGES.NO_CATEGORY };
}
/** 실제 모드 AI 분석: 서버에 기본 정보 저장 → 분석 요청 → 폴링. 결과가 오면(화면을 떠났어도) 초안에 반영 */
async function analyzeReal(userId: string, token: string) {
  const done = (ai: Draft['ai']) => { const d = getState().drafts[userId]; if (d && d.ai.status === 'analyzing' && d.ai.signature === token) patchDraft(userId, { ai }); };
  const failed: Draft['ai'] = { status: 'failed', signature: token, category: '', reason: '' };
  try {
    const id = await ensureServerDraft(userId), d = getState().drafts[userId];
    // TODO(api-gap): 점검 질문 → FAQ(suggestionId) 저장 흐름
    done(aiStateOf(token, await analyzeDraft(d, id), d.images.length));
  } catch (e) { done({ ...failed, reason: isApiError(e, 'PRODUCT_STATE') ? PRODUCT_STATE_MESSAGE : errorMessage(e) }); }
}
/** 화면을 떠나도 계속되는 AI 분석(mock은 목업) */
const ANALYSIS_MS = 2500;
function startAnalysis(userId: string) {
  // 실제 모드: 진행 중인 분석이 있으면 새로 시작하지 않는다(같은 초안에 저장·요청이 겹치면 version만 오른다)
  if (!USE_MOCK && getState().drafts[userId]?.ai.status === 'analyzing') return;
  const token = Date.now().toString(36);
  patchDraft(userId, { ai: { status: 'analyzing', signature: token, category: '', reason: '' } });
  if (!USE_MOCK) { void analyzeReal(userId, token); return; }
  setTimeout(() => {
    const state = getState(), d = state.drafts[userId];
    if (!d || d.ai.status !== 'analyzing' || d.ai.signature !== token) return;
    // 미리보기 도구의 AI 결과 선택: uncertain = UNCLEAR, unsupported = NOT_APPLICABLE, failed = 요청 실패
    if (state.aiOutcome === 'failed' || !d.images.length) { patchDraft(userId, { ai: { status: 'failed', signature: token, category: '', reason: '' } }); return; }
    const r = mockAiAnalysis(d), outcome = state.aiOutcome === 'uncertain' ? 'UNCLEAR' : state.aiOutcome === 'unsupported' ? 'NOT_APPLICABLE' : 'RECOMMENDED';
    patchDraft(userId, { ai: aiStateOf(token, { ...r, outcome }, d.images.length) });
  }, ANALYSIS_MS);
}
function useDraft() {
  const s = useStore(), user = activeUser(s); const [params] = useSearchParams(); const editId = params.get('edit');
  useEffect(() => {
    if (!user.seller) return;
    mutate(state => {
      const existing = state.drafts[user.id];
      if (editId) { if (USE_MOCK && existing?.editingId !== editId) { const p = state.products.find(p => p.id === editId && p.sellerId === user.id); if (p && nowOf(state) < p.startsAt) state.drafts[user.id] = fromProduct(p); } }
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
const SALE_MS = 3 * 3_600_000;
const TIME_SLOTS = Array.from({ length: 48 }, (_, i) => hhmm(Math.floor(i / 2), i % 2 * 30));

/* ── 판매 상품 등록 / 판매 정보 수정 ─────────────────────────────────────────────── */
export function WizardPage() {
  const { s, user, editId, d, suffix, patch } = useDraft(); const now = useClock(); const navigate = useNavigate(); const [params, setParams] = useSearchParams(); const toast = useToast();
  // 실제 모드: 수정할 상품의 편집 원본·이미지를 서버에서 받아 초안으로 만든다(mock은 store 상품으로 useDraft가 만든다)
  const live = useLive(async signal => (editId ? getSellerProductWithImages(editId, signal) : null), (st, p) => {
    if (!p) return;
    mergeProducts(st, [p]);
    const m = st.products.find(x => x.id === p.id)!;
    if (canEdit(m, nowOf(st))) st.drafts[user.id] = fromProduct(m);
  }, [editId]);
  const [error, setError] = useState(''), [uploading, setUploading] = useState(false), [progress, setProgress] = useState(''), [photoError, setPhotoError] = useState(''), [fieldErr, setFieldErr] = useState<Record<string, string>>({}), [busy, setBusy] = useState(false), [photo, setPhoto] = useState<number | null>(null), [activeColor, setActiveColor] = useState(0);
  const picking = params.get('pick') === 'category', meta = useRegistrationMeta();
  // 출고지·반품지: 실제 모드는 판매자 주소록, mock은 판매자 설정의 주소
  const book = useApi(async signal => (USE_MOCK ? null : Promise.all([listAddressBook('DISPATCH', signal), listAddressBook('RETURN', signal)])), []);
  if (!user.seller) return <Unavailable message="승인된 판매자만 상품을 등록할 수 있습니다."/>;
  // 실제 모드: 소유권은 서버가 확인한다(상품 sellerId가 계정 id와 다를 수 있어 비교하지 않는다)
  const editing = editId ? s.products.find(p => p.id === editId && (!USE_MOCK || p.sellerId === user.id)) : undefined;
  // 실제 모드는 서버 편집 원본(status 포함)을 받기 전엔 판단하지 않는다(목록·알림에서 온 status 없는 상품으로 잘못 막던 문제)
  if (editId && !USE_MOCK && (live.loading || live.error || !editing?.reviewStatus)) return <LiveStatus state={live}/>;
  if (editId && (!editing || !canEdit(editing, now))) return <Empty title={editing ? editBlocker(editing, now)! : '상품을 찾을 수 없어요'}><Link to="/seller/products" className="btn">상품 관리로</Link></Empty>;
  if (!d || !d.axes || (editId && d.editingId !== editId)) return <LiveStatus state={live}/>;
  const axes = d.axes, colors = d.colors ?? [], sizes = d.sizes ?? [], stock = d.stock ?? {};
  const rejected = editing?.reviewStatus === 'REJECTED', startPassed = rejected && !(new Date(d.startsAt).getTime() > now);
  const setStock = (key: string, n: number) => patch({ stock: { ...stock, [key]: n } });
  // 점검 항목 입력은 attributes로 저장한다. 항목명은 질문 문장이 아니라 고정 표시명(구매자 상품 상세에 그대로 보인다)
  const setExtra = (key: string, value: string) => patch({ extras: d.extras.some(e => e.key === key) ? d.extras.map(e => e.key === key ? { ...e, value } : e) : [...d.extras.filter(e => e.key.trim()), { key, value }] });
  const criteria = meta.data ? criteriaFor(meta.data, d.category) : undefined, questions = d.ai.result?.questions ?? [];
  const color = colors[Math.min(activeColor, colors.length - 1)] ?? '';
  const colorTotal = (c: string) => axes.size ? sizes.reduce((n, sz) => n + (stock[optionKey(c, sz)] ?? 0), 0) : stock[optionKey(c, '')] ?? 0;
  const total = d.options.reduce((n, o) => n + o.stock, 0);
  const blocked = unsupportedInput(d.name, d.description);
  const reference = d.reference;
  const discount = reference && d.price > 0 && d.price < reference.price ? reference.price - d.price : 0;
  const start = new Date(d.startsAt), startOk = Number.isFinite(start.getTime());
  // 판매 기간은 시작부터 3시간 고정(endsAt = startsAt + 3시간, 서버가 계산). 날짜가 바뀌면 날짜도 보여 준다
  const end = new Date(start.getTime() + SALE_MS), endLabel = startOk ? `${end.getDate() !== start.getDate() ? `${dateLabel(localDateTime(end.getTime()))} ` : ''}${hhmm(end.getHours(), end.getMinutes())}` : '';
  const setDate = (date: string) => { if (!date) return; patch({ startsAt: `${date}T${startOk ? hhmm(start.getHours(), start.getMinutes()) : '21:00'}` }); };
  const setTime = (time: string) => patch({ startsAt: `${(startOk ? localDateTime(start.getTime()) : localDateTime(now)).slice(0, 10)}T${time}` });

  async function upload(picked: File[]) {
    // input.value를 비우면 FileList도 비워지므로 호출한 쪽에서 배열로 복사해 넘긴다
    if (!picked.length) return; setUploading(true); setPhotoError('');
    try {
      if (d.images.length + picked.length > 10) throw new Error('상품 사진은 최대 10장까지 등록할 수 있습니다.');
      for (const f of picked) {
        if (/hei[cf]/i.test(f.type) || /\.hei[cf]$/i.test(f.name)) throw new Error(`${f.name}: HEIC는 올릴 수 없어요. JPG·PNG·WEBP로 바꿔 주세요.`);
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) throw new Error(`${f.name}: JPG·PNG·WEBP 이미지만 올릴 수 있어요.`);
        if (f.size < 1 || f.size > 10 * 1024 * 1024) throw new Error(`${f.name}: 사진은 10MB 이하여야 해요.`);
      }
      if (USE_MOCK) { const added = await Promise.all(picked.map(imageData)); patch({ images: [...d.images, ...added], imageSizes: [...(d.imageSizes ?? []), ...picked.map(f => f.size)] }); }
      else { // 실제 모드: 선택 즉시 초안 상품을 만들고 사진을 한 장씩 올린다(권한 발급 → S3 PUT → 완료 확인)
        setProgress('준비 중…');
        const id = await ensureServerDraft(user.id), images = [...d.images], ids = [...(d.imageIds ?? [])], sizes = [...(d.imageSizes ?? [])];
        for (const [n, f] of picked.entries()) {
          setProgress(`${n + 1}/${picked.length}장 올리는 중…`);
          const u = await uploadProductImage(id, f);
          images.push(u.url || URL.createObjectURL(f)); ids.push(u.id); sizes.push(f.size); patch({ images: [...images], imageIds: [...ids], imageSizes: [...sizes] }); // 열람 URL을 못 받아도 선택한 파일로 미리보기
        }
      }
    }
    catch (e) { setPhotoError(errorMessage(e)); } finally { setUploading(false); setProgress(''); }
  }
  const serverId = d.editingId ?? d.serverId;
  /** 사진 삭제·대표 지정: 실제 모드는 서버에도 반영 */
  async function removePhoto(i: number) {
    try { if (!USE_MOCK && serverId && d.imageIds?.[i]) await deleteProductImage(serverId, d.imageIds[i]); patch({ images: d.images.filter((_, j) => j !== i), ...(d.imageIds ? { imageIds: d.imageIds.filter((_, j) => j !== i) } : {}), ...(d.imageSizes ? { imageSizes: d.imageSizes.filter((_, j) => j !== i) } : {}) }); }
    catch (e) { setPhotoError(errorMessage(e)); }
    setPhoto(null);
  }
  async function coverPhoto(i: number) {
    const ids = d.imageIds && [d.imageIds[i], ...d.imageIds.filter((_, j) => j !== i)];
    try { if (!USE_MOCK && serverId && ids) await reorderProductImages(serverId, ids, ids[0]); patch({ images: [d.images[i], ...d.images.filter((_, j) => j !== i)], ...(ids ? { imageIds: ids } : {}), ...(d.imageSizes ? { imageSizes: [d.imageSizes[i], ...d.imageSizes.filter((_, j) => j !== i)] } : {}) }); }
    catch (e) { setPhotoError(errorMessage(e)); }
    setPhoto(null);
  }
  function openCategory() {
    if (d.ai.status === 'analyzing') navigate(`/seller/new/ai/analyzing${suffix}`);
    else if (d.ai.status === 'failed') navigate(`/seller/new/ai/failed${suffix}`);
    else if (d.ai.result) navigate(`/seller/new/ai${suffix}`);
    else { const next = new URLSearchParams(params); next.set('pick', 'category'); setParams(next); }
  }
  /** 빠진 칸으로 스크롤하고 그 칸에 포커스 */
  function showProblems(f: Record<string, string>) {
    setFieldErr(f);
    const first = Object.keys(f)[0], el = first && document.querySelector<HTMLElement>(`[data-field="${first}"]`);
    if (el) { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); el.querySelector<HTMLElement>('input, textarea, select, button')?.focus({ preventScroll: true }); }
  }
  /** AI 분석 버튼: 조건이 빠졌으면 빠진 칸을 표시하고, 갖춰졌으면 분석을 시작한다 */
  function runAnalysis() {
    const f = analysisProblems(d, editing?.reviewStatus);
    if (Object.keys(f).length) { showProblems(f); return; }
    setFieldErr({}); startAnalysis(user.id); navigate(`/seller/new/ai/analyzing${suffix}`);
  }
  const closePicker = () => { const next = new URLSearchParams(params); next.delete('pick'); setParams(next, { replace: true }); };
  async function submit() {
    setError(''); setFieldErr({});
    // 서버는 업무 규칙 오류(PRODUCT_INVALID)에 violations를 주지 않으므로 제출 전에 같은 규칙으로 먼저 막는다
    const settings = s.sellerSettings[user.id];
    const problems = listingProblems(d, { categories: meta.data?.categories ?? [], now, dispatch: USE_MOCK ? !!settings?.shippingAddress : !!book.data?.[0].length, return: USE_MOCK ? !!settings?.returnAddress : !!book.data?.[1].length });
    if (Object.keys(problems).length) { showProblems(problems); setError('빠진 정보를 확인해 주세요.'); return; }
    setBusy(true);
    try {
      if (USE_MOCK) { const product = await atomic(state => publishDraft(state, state.activeUserId, state.drafts[state.activeUserId], nowOf(state))); navigate(`/seller/published/${product.id}`, { replace: true }); return; }
      // 실제 모드: 단계별 저장(버전 이어받기) 후 심사 제출. 승인 상품은 수정 심사 제출
      const id = await ensureServerDraft(user.id);
      // 주소록에서 지워진 주소 id는 보내지 않는다(생략하면 서버가 기본 주소를 쓴다)
      const valid = (v: string | undefined, list?: { id: string }[]) => (v && list?.some(a => a.id === v) ? v : undefined);
      const keep = criteria && new Set(criteria.checks.map(c => attributeName(c.code))); // 다른 카테고리 때 입력한 항목은 보내지 않는다
      const dd = { ...d, extras: keep ? d.extras.filter(e => keep.has(e.key)) : d.extras, dispatchAddressId: valid(d.dispatchAddressId, book.data?.[0]), returnAddressId: valid(d.returnAddressId, book.data?.[1]) };
      if (editing?.reviewStatus === 'APPROVED') { await submitRevisionFromDraft(dd, id); mutate(st => { delete st.drafts[user.id]; }); toast('수정 내용을 심사 요청했어요.'); navigate('/seller/products', { replace: true }); return; }
      const product = await submitListing(dd, id);
      mutate(st => { mergeProducts(st, [product]); delete st.drafts[user.id]; }); navigate(`/seller/published/${product.id}`, { replace: true });
    }
    catch (e) {
      const f = fieldErrors(e);
      // 화면 검사를 통과했는데 PRODUCT_INVALID면 그사이 서버 값이 바뀐 것: 상품을 다시 받아 화면을 새로 그린다
      if (!Object.keys(f).length && isApiError(e, 'PRODUCT_INVALID') && serverId) {
        try {
          const fresh = await getSellerProductWithImages(serverId);
          mutate(st => { mergeProducts(st, [fresh]); const m = st.products.find(x => x.id === fresh.id)!; st.drafts[user.id] = { ...fromProduct(m), editingId: d.editingId, serverId: d.serverId, ai: d.ai }; });
        } catch { /* 다시 받기 실패: 안내만 */ }
        setError('그사이 정보가 바뀌었어요. 확인 후 다시 요청해 주세요');
      } else { setFieldErr(f); setError(errorMessage(e)); }
    } finally { setBusy(false); }
  }
  const FieldError = ({ name }: { name: string }) => fieldErr[name] ? <p role="alert" className="mt-1.5 text-[12px] text-[var(--red)]">{fieldErr[name]}</p> : null;
  const chip = (on: boolean, label: string, onClick: () => void) => <button type="button" onClick={onClick} className={`inline-flex h-8 items-center gap-1 rounded-full px-3.5 text-[13px] ${on ? 'bg-[var(--ink)] font-bold text-white' : 'border border-[var(--border)] text-[var(--aux)]'}`}>{on && <Check size={13} strokeWidth={2.5}/>}{label}</button>;
  const qtyRow = (label: string, key: string, last: boolean) => <div key={key} className={`flex h-[52px] items-center justify-between ${last ? '' : 'border-b border-[var(--line)]'}`}><span className="text-[15px]">{label}</span><Stepper label={label} value={stock[key] ?? 0} onChange={n => setStock(key, n)}/></div>;

  return <div className="space-y-6 pb-4">
    <Header title={editId ? '판매 정보 수정' : '한정 판매 등록'} bare/>
    {editing && <div className="-mt-4 space-y-3">
      {editing.startsAt > 0 && <p className="flex items-center gap-2 text-[12px] text-[var(--meta)]"><span className="rounded-[3px] bg-[var(--soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--aux)]">{rejected ? '반려됨' : '판매 예정'}</span>{`${new Date(editing.startsAt).getMonth() + 1}.${new Date(editing.startsAt).getDate()} (${WEEK[new Date(editing.startsAt).getDay()]}) ${hhmm(new Date(editing.startsAt).getHours(), new Date(editing.startsAt).getMinutes())} 오픈`}{editing.notifySubscribers !== undefined && ` · 알림 신청 ${editing.notifySubscribers}명`}</p>}
      {rejected ? <>
        <Note title="반려 사유">{editing.rejectionReason || '반려 사유가 등록되지 않았어요.'}</Note>
        <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-3.5"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.5] text-[var(--aux)]">고친 내용을 저장하면 작성 중 상태가 되고, 재심사를 요청하면 다시 심사해요.</p></div>
        {/* 반려 상품의 판매 시작이 지났으면 일정부터 미래 시각으로 바꿔야 재요청할 수 있다 */}
        {startPassed && <div role="alert" className="space-y-2 rounded-[6px] border border-[var(--red)] p-3.5"><p className="text-[13px] font-bold text-[var(--red)]">판매 시작 시각이 지났어요</p><p className="text-[12px] text-[var(--aux)]">판매 일정을 지금보다 뒤로 바꾼 뒤 재심사를 요청해 주세요.</p><Button outline className="w-full text-[13px]!" onClick={() => showProblems({ startsAt: '판매 시작 시각이 지났어요. 지금보다 뒤로 바꿔 주세요.' })}>판매 일정 바꾸기</Button></div>}
      </> : <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-3.5"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.5] text-[var(--aux)]">수정하면 판매 심사를 다시 받아요.<br/>심사 중에도 기존 정보로 오픈 일정은 유지돼요.</p></div>}
    </div>}

    {/* 상품 사진 */}
    <section className="space-y-2.5" data-field="images">
      <Label hint="· 필수 · 최대 10장">상품 사진</Label>
      <div className="flex gap-2 overflow-x-auto">
        {d.images.length < 10 && <label className="flex h-20 w-20 shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[6px] border border-[var(--border)]"><Plus size={20} strokeWidth={1.5}/><span className="text-[11px] text-[var(--meta)]">{uploading ? '처리 중' : `${d.images.length}/10`}</span><input aria-label="상품 사진 업로드" type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={uploading} onChange={e => { const picked = Array.from(e.target.files ?? []); e.target.value = ''; void upload(picked); }}/></label>}
        {d.images.map((src, i) => <button type="button" key={src.slice(-24) + i} onClick={() => setPhoto(i)} className="relative shrink-0"><ProductImage src={src} alt={`상품 사진 ${i + 1}`} className="h-20 w-20"/>{i === 0 && <span className="absolute bottom-1.5 left-1.5 rounded-[3px] bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">대표</span>}</button>)}
      </div>
      {progress && <p role="status" className="text-[12px] text-[var(--aux)]">{progress}</p>}
      <ErrorBox message={photoError}/>
      <p className="text-[11px] text-[var(--meta)]">JPG·PNG·WEBP · 장당 10MB 이하 · 첫 번째 사진이 대표예요</p>
      <FieldError name="images"/>
    </section>

    <section data-field="name"><Label hint="· 필수">상품명</Label><input aria-label="상품명" className="field-line" value={d.name} maxLength={50} onChange={e => patch({ name: e.target.value })} placeholder="상품명을 입력해 주세요"/><FieldError name="name"/></section>

    {/* AI 분석·심사 제출에 필요한 값(단계 저장 땐 선택). 비워 두면 보내지 않는다 — 임의 문구로 채우지 않는다. Figma에 추가할 칸 */}
    <section data-field="description"><Label hint="· 필수 · 한두 줄이면 돼요">짧은 설명</Label><textarea aria-label="짧은 설명" rows={2} className="field-line min-h-[64px] resize-y" value={d.description} maxLength={20000} onChange={e => patch({ description: e.target.value })} placeholder="예: 새 상품, 택 그대로, 박스 없음"/><FieldError name="description"/></section>
    <section data-field="disposalReason"><Label hint="· 필수 · 한두 줄이면 돼요">처분 사유</Label><input aria-label="처분 사유" className="field-line" value={d.reason} maxLength={500} onChange={e => patch({ reason: e.target.value })} placeholder="예: 시즌 종료 후 남은 미판매 새 상품"/><FieldError name="disposalReason"/></section>

    <section data-field="state" className="space-y-2">
      <Button outline={!!Object.keys(analysisProblems(d, editing?.reviewStatus)).length} className="flex w-full items-center justify-center gap-1.5 text-[14px]!" disabled={d.ai.status === 'analyzing' || uploading} onClick={runAnalysis}><Sparkles size={15}/>{d.ai.status === 'analyzing' ? 'AI가 분석하고 있어요' : d.ai.result || d.ai.status === 'uncertain' ? 'AI 분석 다시 하기' : 'AI로 카테고리 분석하기'}</Button>
      <p className="text-[12px] text-[var(--meta)]">사진·상품명·짧은 설명·처분 사유를 입력하면 AI가 카테고리를 추천해요</p>
      <FieldError name="state"/>
    </section>

    <section data-field="category"><Label hint="· AI 추천 또는 직접 선택">카테고리</Label>
      {!d.category && d.ai.status === 'uncertain' && d.ai.reason && <p role="status" className="pb-1 text-[12px] text-[var(--aux)]">{d.ai.reason}</p>}
      <button type="button" onClick={openCategory} className="flex h-12 w-full items-center gap-2 border-b border-[var(--line)] text-left">
        <Sparkles size={16} className="shrink-0"/>
        <span className={`min-w-0 flex-1 truncate text-[16px] ${d.category ? '' : 'text-[var(--placeholder)]'}`}>{d.category || (d.ai.status === 'analyzing' ? '사진을 분석하고 있어요' : '카테고리를 선택해 주세요')}</span>
        {(d.category || d.ai.result || d.ai.status === 'analyzing' || d.ai.status === 'failed') && <span className="flex shrink-0 items-center text-[13px] text-[var(--aux)]">분석 결과<ChevronRight size={16}/></span>}
      </button>
      <FieldError name="category"/>
    </section>

    {/* 카테고리별 점검 기준(registration-metadata categoryCriteria) → 입력칸. 값은 2단계 attributes(항목명+값)로 저장. AI 질문은 checkCode가 같은 칸 옆에 */}
    {criteria && <section className="space-y-4" data-field="attributes">
      <div><Label hint="· 심사 때 확인해요">카테고리별 상품 정보</Label><p className="mt-1 text-[12px] text-[var(--meta)]">카테고리마다 확인하는 항목이 달라요</p></div>
      {criteria.checks.map(c => { const q = questions.find(x => x.checkCode === c.code), name = attributeName(c.code); return <div key={c.code}>
        <p className="text-[13px]">{name}</p>
        {q && <p className="mt-1 flex items-start gap-1 text-[12px] text-[var(--aux)]"><Sparkles size={12} className="mt-[3px] shrink-0"/><span>{q.question}{q.reason && <span className="text-[var(--meta)]"> · {q.reason}</span>}</span></p>}
        <input aria-label={name} className="field-line" value={d.extras.find(e => e.key === name)?.value ?? ''} maxLength={ATTRIBUTE_VALUE_MAX} onChange={e => setExtra(name, e.target.value)}/>
      </div>; })}
      {questions.filter(q => !criteria.checks.some(c => c.code === q.checkCode)).map((q, i) => <p key={i} className="flex items-start gap-1 rounded-[6px] bg-[var(--soft)] p-3 text-[12px] text-[var(--aux)]"><Sparkles size={12} className="mt-[3px] shrink-0"/>{q.question}{q.reason && ` · ${q.reason}`}</p>)}
    </section>}

    <section className="space-y-3" data-field="sourceUrl">
      <div><Label hint="· 필수">타 플랫폼 판매 URL</Label><p className="mt-1 text-[12px] text-[var(--meta)]">쿠팡·알리 등에서 판매 중인 같은 상품의 링크</p></div>
      <label className="flex h-12 items-center gap-2 border-b border-[var(--line)]"><Link2 size={17} className="shrink-0 text-[var(--aux)]"/><input aria-label="타 플랫폼 판매 URL" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--placeholder)]" value={d.originalUrl} placeholder="https://" onChange={e => patch({ originalUrl: e.target.value, reference: lookupReference(e.target.value) /* TODO(api-gap): 타 플랫폼 가격 조회 API 없음(목업) */ })}/></label>
      {reference && <div className="flex items-center gap-3 rounded-[6px] bg-[var(--soft)] p-3">{reference.image && <ProductImage src={reference.image} alt={reference.title} className="h-12 w-12 shrink-0"/>}<div className="min-w-0 flex-1"><p className="text-[11px] font-bold text-[var(--meta)]">{reference.platform}</p><p className="truncate text-[13px]">{reference.title}</p><p className="text-[14px] font-bold">{money(reference.price)}</p></div><span className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-[var(--positive)]"><Check size={14}/>확인됨</span></div>}
      {(d.extraUrls ?? []).map((url, i) => <label key={i} className="flex h-12 items-center gap-2 border-b border-[var(--line)]"><Link2 size={17} className="shrink-0 text-[var(--aux)]"/><input aria-label={`추가 URL ${i + 1}`} className="min-w-0 flex-1 bg-transparent text-[15px] outline-none" value={url} placeholder="https://" onChange={e => patch({ extraUrls: (d.extraUrls ?? []).map((u, j) => j === i ? e.target.value : u) })}/></label>)}
      <button type="button" onClick={() => patch({ extraUrls: [...(d.extraUrls ?? []), ''] })} className="flex items-center gap-1 text-[13px] text-[var(--aux)]"><Plus size={14}/>다른 플랫폼 URL 추가</button>
      <FieldError name="sourceUrl"/>
    </section>

    <section className="space-y-2.5" data-field="price"><Label hint="· 필수">한정 판매가</Label>
      <label className="flex h-12 items-center border-b border-[var(--line)]"><input aria-label="한정 판매가" inputMode="numeric" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-[var(--placeholder)]" value={d.price ? d.price.toLocaleString('ko-KR') : ''} placeholder="0" onChange={e => patch({ price: Number(e.target.value.replace(/\D/g, '')) || 0 })}/><span className="text-[14px] text-[var(--aux)]">원</span></label>
      {discount > 0 && reference && <p className="flex items-center gap-2 text-[12px] text-[var(--aux)]"><span className="rounded-[3px] bg-[var(--positive-soft)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--positive)]">{Math.round(discount / reference.price * 100)}% 저렴</span>{`${reference.platform} 판매가보다 ${money(discount)} 저렴해요`}</p>}
      <p className="text-[12px] text-[var(--meta)]">등록한 URL의 판매가보다 낮아야 심사를 요청할 수 있어요</p>
      <FieldError name="price"/>
    </section>

    <section className="space-y-3" data-field="options"><Label hint="· 필수">옵션별 한정 수량</Label>
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
      <p className="text-[12px] text-[var(--meta)]">판매가 시작되면 옵션과 수량을 바꿀 수 없어요</p>
      <FieldError name="options"/>
    </section>

    <section className="space-y-3" data-field="startsAt"><Label hint="· 필수">판매 일정</Label>
      <div className="flex gap-4">
        <label className="relative flex h-12 min-w-0 flex-[1.6] items-center justify-between border-b border-[var(--line)]"><span className="text-[16px]">{startOk ? dateLabel(d.startsAt) : '날짜 선택'}</span><Calendar size={18} className="text-[var(--aux)]"/><input aria-label="판매 날짜" type="date" className="absolute inset-0 opacity-0" min={localDateTime(now).slice(0, 10)} max={localDateTime(now + 7 * 86_400_000).slice(0, 10)} value={startOk ? localDateTime(start.getTime()).slice(0, 10) : ''} onChange={e => setDate(e.target.value)}/></label>
        <label className="relative flex h-12 min-w-0 flex-1 items-center justify-between border-b border-[var(--line)]"><span className="text-[16px]">{startOk ? hhmm(start.getHours(), start.getMinutes()) : '시간'}</span><ChevronDown size={18} className="text-[var(--aux)]"/><select aria-label="판매 시작 시각" className="absolute inset-0 opacity-0" value={startOk ? hhmm(start.getHours(), start.getMinutes()) : ''} onChange={e => setTime(e.target.value)}>{TIME_SLOTS.map(t => <option key={t}>{t}</option>)}</select></label>
      </div>
      {startOk && <p className="flex items-center gap-2 rounded-[6px] bg-[var(--soft)] px-4 py-3 text-[13px] font-bold"><Timer size={16}/>{`${hhmm(start.getHours(), start.getMinutes())} 시작 – ${endLabel} 자동 종료 · 3시간 선착순 판매`}</p>}
      <p className="flex items-start gap-1.5 text-[12px] text-[var(--aux)]"><Info size={14} className="mt-[2px] shrink-0"/>운영자 승인 전에 시작 시각이 지나면 승인이 실패해요. 여유 있게 잡아 주세요</p>
      <FieldError name="startsAt"/>
    </section>

    <section className="space-y-3" data-field="dispatchDays"><Label hint="· 필수">출고 기한</Label>
      <div className="grid grid-cols-3 gap-2">{[1, 2, 3].map(n => <button type="button" key={n} onClick={() => patch({ dispatchDays: n })} className={`h-10 rounded-[6px] text-[13px] ${d.dispatchDays === n ? 'bg-[var(--ink)] font-bold text-white' : 'border border-[var(--border)] text-[var(--aux)]'}`}>{n}영업일</button>)}</div>
      <FieldError name="dispatchDays"/>
    </section>

    {/* 배송비·1인 구매 한도: 서버 필수 값(배송비 ≥ 0, 한도 > 0). Figma에 추가할 칸 */}
    <section className="space-y-2.5" data-field="shipping"><Label hint="· 필수 · 무료면 0">배송비</Label>
      <label className="flex h-12 items-center border-b border-[var(--line)]"><input aria-label="배송비" inputMode="numeric" className="min-w-0 flex-1 bg-transparent text-[16px] outline-none" value={d.shipping.toLocaleString('ko-KR')} onChange={e => patch({ shipping: Number(e.target.value.replace(/\D/g, '')) || 0 })}/><span className="text-[14px] text-[var(--aux)]">원</span></label>
      <FieldError name="shipping"/>
    </section>
    {/* 택배사·반품/교환 배송비: 판매자 설정 API가 없어 상품의 shippingNotice 글로 저장한다. 칸을 고치면 아래 글이 다시 만들어지고, 글은 직접 고칠 수 있다 */}
    <section className="space-y-3" data-field="shippingNotice"><div><Label hint="· 구매자에게 안내돼요">택배사 · 반품·교환 배송비</Label></div>
      {(() => {
        const set = (v: Partial<Pick<Draft, 'carrier' | 'returnFee' | 'exchangeFee'>>) => { const n = { carrier: d.carrier ?? '', returnFee: d.returnFee ?? '', exchangeFee: d.exchangeFee ?? '', ...v }; patch({ ...n, shippingNotice: composeShippingNotice(n.carrier, n.returnFee, n.exchangeFee) }); };
        const digits = (v: string) => v.replace(/\D/g, '');
        return <>
          <label className="block text-[13px]">택배사<select aria-label="택배사" className="field-line" value={d.carrier ?? ''} onChange={e => set({ carrier: e.target.value })}><option value="">선택 안 함</option>{['CJ대한통운', '한진택배', '롯데택배', '우체국택배'].map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="block text-[13px]">반품 배송비<span className="flex items-center border-b border-[var(--line)]"><input aria-label="반품 배송비" inputMode="numeric" className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none" value={d.returnFee ? Number(d.returnFee).toLocaleString('ko-KR') : ''} placeholder="3,000" onChange={e => set({ returnFee: digits(e.target.value) })}/><span className="text-[14px] text-[var(--aux)]">원</span></span></label>
          <label className="block text-[13px]">교환 배송비<span className="flex items-center border-b border-[var(--line)]"><input aria-label="교환 배송비" inputMode="numeric" className="min-w-0 flex-1 bg-transparent py-3 text-[16px] outline-none" value={d.exchangeFee ? Number(d.exchangeFee).toLocaleString('ko-KR') : ''} placeholder="6,000" onChange={e => set({ exchangeFee: digits(e.target.value) })}/><span className="text-[14px] text-[var(--aux)]">원</span></span></label>
        </>;
      })()}
      <label className="block text-[13px]">배송 안내 글<textarea aria-label="배송 안내" rows={3} className="mt-1 w-full rounded-[6px] border border-[var(--border)] p-3 text-[14px] outline-none" value={d.shippingNotice ?? ''} onChange={e => patch({ shippingNotice: e.target.value })}/></label>
      <p className={`text-right text-[12px] ${(d.shippingNotice ?? '').length > SHIPPING_NOTICE_MAX ? 'text-[var(--danger,#d32f2f)]' : 'text-[var(--meta)]'}`}>{(d.shippingNotice ?? '').length.toLocaleString('ko-KR')} / {SHIPPING_NOTICE_MAX.toLocaleString('ko-KR')}자</p>
      <FieldError name="shippingNotice"/>
    </section>
    <section className="space-y-2.5" data-field="maxPerAccount"><div className="flex items-center justify-between"><Label hint="· 필수">1인 구매 한도</Label><Stepper label="1인 구매 한도" value={d.maxPerAccount} onChange={n => patch({ maxPerAccount: n })}/></div>
      <FieldError name="maxPerAccount"/>
    </section>

    <section className="space-y-2.5" data-field="addresses"><Label hint="· 필수">출고지 · 반품지</Label>
      {USE_MOCK ? ([['출고지', s.sellerSettings[user.id]?.shippingAddress], ['반품지', s.sellerSettings[user.id]?.returnAddress]] as const).map(([k, v]) => <div key={k} className="flex justify-between gap-3 text-[13px]"><span className="shrink-0 text-[var(--aux)]">{k}</span><span className="text-right">{v || '등록된 주소가 없어요'}</span></div>)
        : book.data && ([['출고지', 'dispatchAddressId', book.data[0]], ['반품지', 'returnAddressId', book.data[1]]] as const).map(([k, key, list]) => <label key={k} className="flex items-center gap-3 text-[13px]"><span className="w-12 shrink-0 text-[var(--aux)]">{k}</span>
          {/* 선택하지 않으면 서버가 기본 주소를 쓴다 */}
          {list.length ? <select aria-label={k} className="field-line min-w-0 flex-1" value={d[key] && list.some(a => a.id === d[key]) ? d[key] : list.find(a => a.defaultAddress)?.id ?? ''} onChange={e => patch({ [key]: e.target.value })}>{list.map(a => <option key={a.id} value={a.id}>{a.label}{a.defaultAddress ? ' (기본)' : ''} · {a.address.roadAddress}</option>)}</select> : <span>등록된 주소가 없어요</span>}
        </label>)}
      {!USE_MOCK && <LiveStatus state={book}/>}
      <FieldError name="addresses"/>
      <Link to="/seller/settings/addresses" className="text-[12px] text-[var(--aux)] underline">출고지·반품지 관리</Link>
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
      <Button className="w-full text-[15px]!" disabled={busy || uploading || blocked} onClick={submit}>{busy ? '요청 중…' : editId ? (editing?.reviewStatus === 'REJECTED' ? '수정하고 재심사 요청' : '수정 내용 저장') : '판매 심사 요청하기'}</Button>
    </div>

    {photo !== null && d.images[photo] && <Modal title={`상품 사진 ${photo + 1}`} onClose={() => setPhoto(null)}><div className="space-y-3"><ProductImage src={d.images[photo]} alt="선택한 사진" className="aspect-square w-full"/>{photo > 0 && <Button className="w-full" onClick={() => void coverPhoto(photo)}>대표 사진으로 지정</Button>}<Button outline className="w-full" onClick={() => void removePhoto(photo)}>삭제</Button></div></Modal>}
    {picking && <CategoryPicker value={d.category} onClose={closePicker} onSave={category => { patch({ category }); closePicker(); }}/>}
  </div>;
}
function CategoryPicker({ value, onClose, onSave }: { value: string; onClose: () => void; onSave: (v: string) => void }) {
  const [pick, setPick] = useState(value), [q, setQ] = useState('');
  // 허용 카테고리는 서버 registration-metadata의 categories(이름)에서만 고른다. mock도 같은 모양의 목업
  const meta = useRegistrationMeta();
  const list = (meta.data?.categories ?? []).filter(c => c.includes(q.trim()));
  return <Modal title="카테고리 선택" onClose={onClose}><div className="space-y-1">
    <input aria-label="카테고리 검색" className="field-line" value={q} onChange={e => setQ(e.target.value)} placeholder="카테고리 이름으로 찾기"/>
    <LiveStatus state={meta}/>
    <div className="max-h-[50dvh] overflow-y-auto">{list.map(path => <label key={path} className="divider flex items-center gap-3 py-3 text-[13px]"><input type="radio" name="category" value={path} checked={pick === path} onChange={() => setPick(path)}/>{path}</label>)}</div>
    {meta.data && !list.length && <p className="py-3 text-[13px] text-[var(--meta)]">찾는 카테고리가 없어요</p>}
    <Note>지원 목록에서만 선택할 수 있습니다. 등록 대상이 아닌 상품은 다른 카테고리로 우회 등록할 수 없습니다.</Note><Button className="mt-4 w-full" disabled={!pick} onClick={() => onSave(pick)}>카테고리 저장</Button></div></Modal>;
}

/* ── AI 상품 분석 (결과 / 분석 중 / 실패와 재시도) ─────────────────────────────────── */
function AiFrame({ children, footer }: { children: ReactNode; footer: ReactNode }) {
  return <div className="flex min-h-[calc(100dvh-44px)] flex-col"><Header title="AI 상품 분석" bare/><div className="flex-1 space-y-5">{children}</div><div className="pt-8">{footer}</div></div>;
}
function Thumbs({ images }: { images: string[] }) { return <div className="flex gap-2">{(images.length ? images.slice(0, 4) : ['', '']).map((src, i) => <div key={i} className="h-[72px] w-[72px] rounded-[4px] bg-[var(--soft)]" aria-hidden={!src}/>)}</div>; }

export function AiAnalysisPage() {
  const { user, d, suffix, patch } = useDraft(); const navigate = useNavigate(); const [pick, setPick] = useState<string>(''); const meta = useRegistrationMeta();
  if (!user.seller) return <Unavailable message="승인된 판매자만 상품을 등록할 수 있습니다."/>;
  if (!d) return null;
  if (d.ai.status === 'analyzing') return <Navigate to={`/seller/new/ai/analyzing${suffix}`} replace/>;
  if (d.ai.status === 'uncertain') return <Navigate to={`/seller/new${suffix}`} replace/>;
  if (d.ai.status === 'failed' || !d.ai.result) return <Navigate to={`/seller/new/ai/failed${suffix}`} replace/>;
  const r = d.ai.result, chosen = pick || r.category;
  // 추천 코드에 속한 등록 카테고리 중에서 바꿀 수 있다(추천값이 기본 선택). 다른 분류는 직접 선택으로
  const list = meta.data ? categoriesForCode(meta.data, r.code) : [r.category];
  const back = () => navigate(`/seller/new${suffix}`);
  return <AiFrame footer={<div className="flex gap-2"><Button outline className="w-[128px] text-[15px]!" onClick={() => { startAnalysis(user.id); navigate(`/seller/new/ai/analyzing${suffix}`, { replace: true }); }}>다시 분석</Button><Button className="flex-1 text-[15px]!" onClick={() => { patch({ category: chosen }); back(); }}>이 카테고리로 적용</Button></div>}>
    <div className="space-y-2"><div className="relative"><ProductImage src={d.images[0]} alt="분석한 대표 사진" className="h-[240px] w-full"/><span className="absolute left-3 top-3 flex items-center gap-1 rounded-[4px] bg-black/70 px-2 py-1 text-[11px] font-bold text-white"><Sparkles size={12}/>AI 분석 완료</span></div><p className="text-[12px] text-[var(--meta)]">등록한 사진 {r.photos}장을 분석했어요</p></div>
    <div className="space-y-1"><p className="text-[12px] font-bold text-[var(--meta)]">AI 추천 카테고리</p><p className="text-[22px] font-bold">{r.category}</p></div>
    <section><h2 className="mb-1 text-[14px] font-bold">카테고리 선택</h2><LiveStatus state={meta}/>
      {list.map(path => <label key={path} className="flex h-12 cursor-pointer items-center gap-3 border-b border-[var(--line)]"><input type="radio" name="ai-category" className="peer sr-only" checked={chosen === path} onChange={() => setPick(path)}/><span className={`grid h-5 w-5 place-items-center rounded-full border-[1.5px] ${chosen === path ? 'border-[var(--ink)]' : 'border-[var(--border)]'}`}>{chosen === path && <span className="h-2.5 w-2.5 rounded-full bg-[var(--ink)]"/>}</span><span className="flex-1 text-[14px]">{path}</span>{path === r.category && <span className="text-[11px] font-bold text-[var(--positive)]">AI 추천</span>}</label>)}
      <button type="button" onClick={() => navigate(`/seller/new${suffix}${suffix ? '&' : '?'}pick=category`)} className="mt-3 flex items-center text-[13px] text-[var(--aux)]">다른 카테고리 직접 선택<ChevronRight size={15}/></button>
    </section>
    {r.questions.length > 0 && <><div className="-mx-4 h-2 bg-[var(--divider)]"/><section className="space-y-3"><h2 className="text-[16px] font-bold">AI 점검 질문</h2><p className="text-[12px] text-[var(--aux)]">카테고리를 적용하면 등록 화면의 해당 입력칸 옆에도 보여요</p>{r.questions.map((q, i) => <div key={i} className="space-y-1 rounded-[6px] border border-[var(--line)] p-3.5"><p className="text-[14px] font-bold">{q.question}</p>{q.reason && <p className="text-[12px] text-[var(--aux)]">{q.reason}</p>}</div>)}</section></>}
    <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-4"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.5] text-[var(--aux)]">AI 분석 결과는 판매 심사에서 한 번 더 확인해요.<br/>카테고리가 다르면 목록에서 바꿔 주세요.</p></div>
  </AiFrame>;
}

export function AiAnalyzingPage() {
  const { user, d, suffix } = useDraft(); const navigate = useNavigate();
  useEffect(() => { if (d && d.ai.status !== 'analyzing') navigate(d.ai.status === 'uncertain' ? `/seller/new${suffix}` : `/seller/new/ai${d.ai.status === 'failed' ? '/failed' : ''}${suffix}`, { replace: true }); }, [d?.ai.status]);
  if (!user.seller) return <Unavailable message="승인된 판매자만 상품을 등록할 수 있습니다."/>;
  if (!d) return null;
  return <AiFrame footer={<Button outline className="w-full text-[15px]!" onClick={() => navigate(`/seller/new${suffix}`)}>기다리지 않고 등록 계속하기</Button>}>
    <Thumbs images={d.images}/>
    <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--soft)]"><Sparkles size={18}/></span>
    <div className="space-y-3"><h1 className="text-[24px] font-bold leading-[1.45] tracking-[-.7px]">등록한 사진 {d.images.length}장을<br/>분석하고 있어요</h1><p className="text-[13px] text-[var(--aux)]">보통 10초 안에 끝나요.</p></div>
    <div className="h-1 w-full overflow-hidden rounded-full bg-[var(--line)]"><div className="h-1 w-[60%] rounded-full bg-[var(--ink)]"/></div>
    <div className="space-y-3.5">{([['카테고리', 60], ['점검 질문', 44]] as const).map(([label, w]) => <div key={label} className="flex items-center justify-between"><span className="text-[12px] text-[var(--muted)]">{label}</span><span className="h-3 rounded-[2px] bg-[var(--soft)]" style={{ width: `${w}%` }}/></div>)}</div>
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
    <div className="space-y-2"><h1 className="text-[24px] font-bold tracking-[-.7px]">사진을 분석하지 못했어요</h1><p className="text-[13px] text-[var(--aux)]">{d.ai.reason ? d.ai.reason : '사진이 흐리거나 상품이 잘 보이지 않으면 분석이 어려워요.'}</p></div>
    <div className="space-y-2 rounded-[6px] bg-[var(--infobar)] p-4"><p className="text-[13px] font-bold">이렇게 하면 더 잘 분석돼요</p><p className="whitespace-pre-line text-[12px] leading-[1.7] text-[var(--aux)]">{'· 상품 전체가 보이도록 밝은 곳에서 촬영\n· 라벨·택이 보이는 사진을 함께 등록\n· 한 사진에 상품 하나만'}</p></div>
    <div className="flex gap-2 rounded-[6px] bg-[var(--soft)] p-4"><Info size={15} className="mt-[2px] shrink-0 text-[var(--aux)]"/><p className="text-[12px] leading-[1.6] text-[var(--aux)]">AI 분석 없이 카테고리를 직접 선택해도 판매 심사를 요청할 수 있어요. 입력한 내용은 그대로 저장돼 있어요.</p></div>
  </AiFrame>;
}
