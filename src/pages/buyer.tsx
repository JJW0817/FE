import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, Bell, ExternalLink, Bookmark, Clock3, Plus, Minus, MessageSquare, Truck, CheckCircle2, ChevronRight, PackageCheck, Calendar } from 'lucide-react';
import { Badge, Button, CopyButton, DeliveryProgress, Empty, ErrorBox, Field, Header, InfoRow, Modal, Note, ORDER_LABELS, ProductCard, ProductImage, ProductSummary, useToast } from '../components/ui';
import { activeUser, available, beginPayment, DomainError, money, nowOf, reserve, resolvePayment, saleState, uid } from '../domain';
import type { Address, Hold, Product, Order } from '../domain';
import { atomic, getState, mutate, useStore } from '../store';
import { externalHref } from '../files';
import { countdown, dateTime, shortDate, useClock } from '../hooks';
import { loginHref, signedIn } from '../auth';

export function HomePage() {
  const s = useStore(), now = useClock(); const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '', category = params.get('category') ?? '전체', filter = params.get('state') ?? '전체';
  const setParam = (key: string, value: string) => { const next = new URLSearchParams(params); if (!value || value === '전체') next.delete(key); else next.set(key, value); setParams(next, { replace: true }); };
  const products = s.products.filter(p => p.published && (category === '전체' || p.category.startsWith(category)) && (filter === '전체' || (filter === '마감 임박' ? saleState(p, now) === '판매 중' && p.endsAt - now <= 3_600_000 : saleState(p, now) === filter)) && `${p.name} ${p.brand} ${p.category}`.toLowerCase().includes(query.toLowerCase()));
  const hero = s.products.find(p => p.id === 'ecobag')!;
  const showHero = !query && category === '전체' && filter === '전체';
  return <div className="space-y-[14px]"><header className="divider pb-3"><div className="flex items-center justify-between"><h1 className="text-[28px] font-black italic tracking-[-1.2px]">STOCKDROP</h1><Link aria-label="알림 및 주문 확인" to="/notifications" className="grid h-9 w-9 place-items-center"><Bell size={19} strokeWidth={1.5}/></Link></div><p className="muted mt-1 text-[11px]">남은 재고에 새 주인을, 정해진 시간에.</p></header>
    <label className="flex h-10 items-center gap-2.5 rounded-[4px] bg-[var(--blue-soft)] px-3.5"><Search size={18} className="muted"/><input aria-label="상품 검색" value={query} onChange={e => setParam('q', e.target.value)} placeholder="상품명·카테고리·판매처 검색" className="min-w-0 flex-1 bg-transparent text-[13px] outline-none"/></label>
    <div role="group" aria-label="상품 카테고리" className="divider flex justify-between gap-2">{['전체', '의류', '패션잡화', '문구', '생활잡화'].map(c => <button key={c} onClick={() => setParam('category', c)} className={`border-b-2 pb-3 pt-1 text-[12px] ${category === c ? 'border-[var(--ink)] font-bold' : 'border-transparent'}`}>{c}</button>)}</div>
    <div className="flex gap-1.5">{['전체', '마감 임박', '판매 중', '판매 예정', '판매 종료'].map(f => <button key={f} onClick={() => setParam('state', f)} className={`rounded-[4px] px-2.5 py-1.5 text-[11px] ${filter === f ? 'bg-[var(--ink)] font-semibold text-[var(--surface)]' : 'muted'}`}>{f}</button>)}</div>
    {showHero && <Link to={`/product/${hero.id}`} className="block space-y-2"><div className="bg-[var(--ink)] p-5 text-[var(--surface)]"><p className="text-[9px] font-semibold tracking-[1px] opacity-70">STOCKDROP 시간 한정 판매</p><h2 className="mt-1 font-number text-[26px] font-extrabold tracking-[-.8px]">단 3시간, 한정 판매</h2><p className="mt-2 text-[11px] opacity-70">혼자 운영하는 쇼핑몰의 남은 재고를 새 주인에게.</p></div><ProductImage src={hero.images[0]} alt={hero.name} className="h-[260px] w-full rounded-none!"/><div className="flex items-center justify-between"><Badge live={saleState(hero, now) === '판매 중'}>{saleState(hero, now)}</Badge><span className="text-[10px] text-[var(--red)]">패션잡화 · 구매 가능 {hero.options.reduce((n, o) => n + available(s, hero, o.id, now), 0)}개</span></div><p className="pt-1 text-[12px] font-bold">{hero.brand}</p><h2 className="text-[17px]">{hero.name}</h2><p className="font-number text-[18px] font-bold">{money(hero.price)}</p></Link>}
    <div className="flex items-end justify-between pt-4"><div><h2 className="text-[20px] font-bold">{query ? `검색 결과 ${products.length}개` : '새로 올라온 상품'}</h2><p className="muted mt-1 text-[11px]">의류 · 패션잡화 · 문구 · 생활잡화</p></div>{showHero && <button className="muted text-[11px]" onClick={() => setParam('state', '판매 예정')}>더보기</button>}</div>
    {products.length ? <div className="grid grid-cols-2 gap-x-2 gap-y-6">{products.map(p => <ProductCard key={p.id} product={p} now={now}/>)}</div> : <Empty title="검색 결과가 없어요" message="검색어나 카테고리를 바꿔 보세요."><Button outline onClick={() => setParams({})}>필터 초기화</Button></Empty>}
    <p className="muted py-4 text-[10px]">미판매 새 상품만 판매합니다. 중고·전시·하자 상품은 제외돼요.</p>
  </div>;
}

export function SchedulePage() {
  const s = useStore(), now = useClock(); const [selected, setSelected] = useState('전체'); const [weekOffset, setWeekOffset] = useState<0 | 1>(0);
  const products = s.products.filter(p => p.published && p.endsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7 + weekOffset * 7);
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return { key: shortDate(date.getTime()), weekday: ['월', '화', '수', '목', '금', '토', '일'][index], date: `${date.getMonth() + 1}.${date.getDate()}` }; });
  const visible = products.filter(p => selected === '전체' || shortDate(p.startsAt) === selected);
  const moveWeek = (offset: 0 | 1) => { setWeekOffset(offset); setSelected('전체'); };
  return <><Header title="판매 일정" subtitle="모든 판매는 오픈 후 3시간 동안만 진행돼요" back={false}/><div className="mb-6 space-y-2"><div className="flex items-center justify-between"><div className="flex gap-2"><button type="button" onClick={() => moveWeek(0)} className={`px-2 py-2 text-[11px] ${weekOffset === 0 ? 'font-bold' : 'muted'}`}>이번 주</button><button type="button" onClick={() => moveWeek(1)} className={`px-2 py-2 text-[11px] ${weekOffset === 1 ? 'font-bold' : 'muted'}`}>다음 주</button></div><div className="flex items-center gap-2"><span className="muted text-[11px]">{week[0]?.date} – {week[6]?.date}</span><Link to="/schedule/calendar" className="text-[11px] underline">전체 일정</Link></div></div><button onClick={() => setSelected('전체')} className={`w-full rounded-[4px] py-2 text-[12px] ${selected === '전체' ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--blue-soft)]'}`}>전체</button><div className="grid grid-cols-7 gap-1">{week.map(day => <button key={day.key} onClick={() => setSelected(day.key)} aria-label={`${day.key} ${day.weekday}요일`} className={`flex min-w-0 flex-col items-center rounded-[4px] px-1 py-2 ${selected === day.key ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--blue-soft)]'}`}><b className="text-[12px]">{day.weekday}</b><span className="mt-1 text-[9px] opacity-70">{day.date}</span></button>)}</div></div>{selected !== '전체' && (() => { const selDate = new Date(selected); const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']; return <div className="flex items-center justify-between py-2"><h2 className="text-[14px] font-bold">{selDate.getMonth() + 1}월 {selDate.getDate()}일 {dayNames[selDate.getDay()]}</h2><span className="muted text-[11px]">판매 {visible.length}개</span></div>; })()}{(() => { const selling = visible.filter(p => saleState(p, now) === '판매 중'); const upcoming = visible.filter(p => saleState(p, now) === '판매 예정'); const groups: [string, number, typeof visible][] = []; if (selling.length) groups.push(['지금 판매 중', selling.length, selling]); if (upcoming.length) groups.push(['오픈 예정', upcoming.length, upcoming]); const other = visible.filter(p => !['판매 중', '판매 예정'].includes(saleState(p, now))); if (other.length) groups.push(['판매 종료', other.length, other]); return groups.length ? groups.map(([label, count, items]) => <section key={label}><div className="flex items-center gap-2 py-3"><h3 className="text-[13px] font-bold">{label}</h3><span className="muted text-[11px]">{count}</span></div>{items.map(p => { const state = saleState(p, now); const timeLabel = state === '판매 중' ? `${new Date(p.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${new Date(p.endsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}` : `${new Date(p.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 오픈`; return <Link key={p.id} to={`/product/${p.id}`} className="divider flex items-center gap-3 py-4"><ProductImage src={p.images[0]} alt={p.name} className="h-[72px] w-[72px]"/><div className="min-w-0 flex-1 space-y-1"><div className="flex items-center gap-2"><Badge live={state === '판매 중'}>{state === '판매 예정' ? '오픈 예정' : state}</Badge><span className="muted text-[10px]">{timeLabel}</span></div><h2 className="text-[14px] font-semibold">{p.name}</h2><p className="muted text-[10px]">{p.category}</p><div className="flex items-center justify-between"><span className="font-number text-[13px] font-bold">{money(p.price)}</span><span className="muted text-[10px]">{state === '판매 중' ? `${countdown(p.endsAt, now)} 남음` : state === '판매 예정' ? '알림 받기' : ''}</span></div></div></Link>; })}</section>) : <Empty title="선택한 날의 판매 일정이 없어요" message="다른 요일을 선택하거나 전체 일정을 확인해 보세요."/>; })()}</>;
}

export function ProductPage() {
  const { id } = useParams(); const s = useStore(), now = useClock(), toast = useToast(); const p = s.products.find(p => p.id === id); const navigate = useNavigate(); const [optionsOpen, setOptionsOpen] = useState(false); const [extPopup, setExtPopup] = useState(false);
  if (!p || !p.published) return <Empty title="상품을 찾을 수 없어요"><Link to="/" className="btn">홈으로</Link></Empty>;
  const status = saleState(p, now), qty = p.options.reduce((n, o) => n + available(s, p, o.id, now), 0), saved = s.bookmarks.includes(`${s.activeUserId}:${p.id}`);
  const bookmark = () => mutate(state => { const key = `${state.activeUserId}:${p.id}`; state.bookmarks = saved ? state.bookmarks.filter(k => k !== key) : [...state.bookmarks, key]; });
  return <div className="space-y-4"><Header title="상품 상세" subtitle="결제가 완료된 주문부터 확정돼요" action={<button aria-label={saved ? '관심 상품 해제' : '관심 상품 저장'} onClick={() => { if (!signedIn(s)) { navigate(loginHref(`/product/${p.id}`)); return; } bookmark(); toast(saved ? '관심 상품에서 해제했습니다.' : '관심 상품에 저장했습니다.'); }} className="grid h-9 w-9 place-items-center"><Bookmark size={20} fill={saved ? 'currentColor' : 'none'}/></button>}/><ProductImage src={p.images[0]} alt={p.name} className="aspect-square w-full rounded-none!"/>
    <div className="flex items-center justify-between gap-3"><Badge live={status === '판매 중'}>{status === '판매 예정' ? '오픈 예정' : status}</Badge><p className="text-[11px] text-[var(--red)]">{status === '판매 중' ? `마감까지 ${countdown(p.endsAt, now)}` : status === '판매 예정' ? `${p.category} · 3시간 한정` : '신규 구매가 종료되었어요'}</p></div>
    {status === '판매 예정' && <div className="rounded-[4px] bg-[var(--blue-soft)] p-5 text-center"><p className="muted mb-2 text-[11px]">판매 시작까지</p><p className="font-number text-[32px] font-bold">{countdown(p.startsAt, now)}</p><p className="muted mt-2 text-[10px]">{dateTime(p.startsAt)} 오픈</p></div>}
    {status === '판매 종료' && qty <= 0 && <div className="space-y-3 rounded-[4px] bg-[var(--blue-soft)] p-5 text-center"><p className="font-number text-[28px] font-extrabold tracking-[-1px]">SOLD OUT</p><p className="text-[14px] font-bold">선착순 판매 종료됐어요</p><p className="muted text-[11px]">선착순 마감되었습니다. 다음 판매를 노려보세요</p></div>}
    <Note title={status === '판매 예정' ? '게시 즉시 공개 · 구매는 시작 시각부터' : '3시간 한정 선착순'}>{status === '판매 예정' ? '판매 시작 전에는 탐색과 Q&A만 가능합니다. 구매하거나 재고를 확보할 수 없습니다.' : '옵션 선택은 재고 확보가 아닙니다. 구매하기로 확보에 성공하면 5분 안에 결제를 완료해 주세요.'}</Note>
    <p className="text-[12px] font-bold">{p.category} · {p.brand}</p><h1 className="text-[22px] tracking-[-.5px]">{p.name}</h1><p className="muted text-[10px]">미판매 새 상품 · 중고·전시·하자 상품 제외</p>
    <button className="divider flex w-full items-center gap-3 py-3 text-left" onClick={() => setExtPopup(true)}><ExternalLink size={18}/><div><p className="text-[12px] font-semibold">기존 판매처에서 상품 보기</p><p className="muted mt-1 text-[10px]">외부 판매처의 가격과 판매조건은 직접 확인해 주세요.</p></div></button>
    <div><p className="font-number text-[24px] font-bold">{money(p.price)}</p><p className="muted mt-2 text-[11px]">고정 배송비 {money(p.shipping)} · 최종 결제금액은 수량 선택 후 표시</p></div>
    <div className="divider space-y-2 py-4"><InfoRow label="판매 시작" value={dateTime(p.startsAt)}/><InfoRow label="판매 종료" value={`${dateTime(p.endsAt)} · 3시간 후 자동 종료`}/><InfoRow label="출고 예정" value={`결제 후 ${p.dispatchDays}영업일 이내`}/><InfoRow label="계정당 구매 상한" value={`최대 ${p.maxPerAccount}개`}/></div>
    <h2 className="text-[15px] font-bold">옵션별 구매 가능 수량</h2>{p.options.map(o => <div key={o.id} className="divider flex items-center justify-between gap-3 py-3"><span className="text-[13px]">{o.name}</span><span className="text-[12px] text-[var(--green)]">{status === '판매 중' ? `${available(s, p, o.id, now)}개` : status === '판매 예정' ? '판매 시작 후 구매 가능' : '판매 종료'}</span></div>)}
    <section className="space-y-3 py-3"><h2 className="text-[15px] font-bold">상품 정보</h2><p className="whitespace-pre-line text-[12px] leading-[1.8]">{p.description}</p>{p.extras.map((e, i) => <InfoRow key={i} label={e.key} value={e.value}/>)}<InfoRow label="재고 처분 사유" value={p.reason}/></section>
    <section className="divider space-y-3 py-4"><h2 className="text-[15px] font-bold">판매자 확인 FAQ</h2>{p.faqs.filter(f => f.confirmed).map(f => <details key={f.id} className="divider py-2"><summary className="text-[12px] font-semibold">{f.question}</summary><p className="muted mt-3 whitespace-pre-line text-[12px] leading-relaxed">{f.answer}</p></details>)}</section>
    <div className="grid grid-cols-2 gap-2"><Link className="btn btn-outline" to={`/qa/${p.id}`}><MessageSquare size={16}/>AI에게 질문</Link><Link className="btn btn-outline" to={`/qa/${p.id}?direct=1`}>판매자 문의</Link></div><p className="muted text-[10px] leading-relaxed">교환은 지원하지 않습니다. 취소·반품·하자·오배송은 주문 내역에서 판매자에게 문의해 주세요.</p>
    {status === '판매 종료' && qty <= 0 && <section className="space-y-3"><h2 className="text-[15px] font-bold">놓친 상품과 비슷한 상품</h2><div className="grid grid-cols-2 gap-x-2 gap-y-4">{s.products.filter(r => r.published && r.id !== p.id && r.category === p.category && r.endsAt > now).slice(0, 4).map(r => <ProductCard key={r.id} product={r} now={now}/>)}</div>{s.products.some(r => r.published && r.id !== p.id && r.category === p.category && r.endsAt > now) && <Link className="btn btn-outline w-full" to={`/?category=${encodeURIComponent(p.category.split(' > ')[0])}`}>전체보기</Link>}</section>}
    <div className="sticky bottom-[76px] z-20 -mx-4 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3">{status === '판매 종료' && qty <= 0 ? <div className="flex gap-2"><Link className="btn flex-1" to="/">홈으로</Link><Link className="btn btn-outline flex-1" to={`/?category=${encodeURIComponent(p.category.split(' > ')[0])}`}>비슷한 상품 보기</Link></div> : <Button buy className="w-full" disabled={status !== '판매 중' || qty <= 0} onClick={() => signedIn(s) ? setOptionsOpen(true) : navigate(loginHref(`/product/${p.id}`))}>{status === '판매 예정' ? '판매 시작 전 · 구매할 수 없어요' : status === '판매 종료' ? '판매가 종료되었습니다' : qty <= 0 ? '일시 품절 · 재고를 확인해 주세요' : `남은 ${qty}개 · 선착순 구매하기`}</Button>}</div>
    {optionsOpen && <OptionSheet product={p} onClose={() => setOptionsOpen(false)}/>}
    {extPopup && <Modal title="외부 사이트로 이동할까요?" onClose={() => setExtPopup(false)}><div className="space-y-4"><p className="muted text-[12px]">STOCKDROP을 벗어나 판매처 페이지가 새 창으로 열려요.</p><div className="rounded-[4px] bg-[var(--blue-soft)] p-3"><p className="text-[12px] font-bold">{p.brand}</p><p className="muted mt-1 break-all text-[10px]">{p.originalUrl}</p></div><p className="muted text-[10px]">판매처의 가격·배송·교환 조건은 STOCKDROP과 다를 수 있어요.</p><div className="flex gap-2"><Button outline className="flex-1" onClick={() => setExtPopup(false)}>취소</Button><Button className="flex-1" onClick={() => { window.open(externalHref(p.originalUrl, p.id), '_blank', 'noopener,noreferrer'); setExtPopup(false); }}>이동하기</Button></div></div></Modal>}
  </div>;
}

function OptionSheet({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const s = useStore(), now = useClock(), navigate = useNavigate(); const [quantities, setQuantities] = useState<Record<string, number>>({}); const [error, setError] = useState(''), [busy, setBusy] = useState(false), [existing, setExisting] = useState('');
  const count = Object.values(quantities).reduce((a, b) => a + b, 0);
  async function buy() { setError(''); setExisting(''); setBusy(true); try { const hold = await atomic(state => reserve(state, state.activeUserId, p.id, quantities, nowOf(state))); onClose(); navigate(`/checkout/${hold.id}`); } catch (e) { const err = e as DomainError; setError(err.message); if (err.code?.startsWith('existing:')) setExisting(err.code.slice(9)); } finally { setBusy(false); } }
  return <Modal title="옵션 선택" onClose={onClose}><div className="space-y-4"><ProductSummary product={{ ...p, image: p.images[0] }}/><p className="muted text-[11px] leading-relaxed">옵션 선택만으로는 재고가 확보되지 않아요. 한 판매자의 한 상품에 속한 여러 옵션만 함께 주문할 수 있습니다.</p><Note title="선착순 진행 중">종료까지 {countdown(p.endsAt, now)} · 계정당 최대 {p.maxPerAccount}개</Note>{p.options.map(o => <div key={o.id} className="divider space-y-2 py-3"><div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium">{o.name}</span><span className="muted text-[10px]">구매 가능 {available(s, p, o.id, now)}개</span></div><div className="flex items-center justify-end gap-2"><button aria-label={`${o.name} 수량 감소`} className="grid h-9 w-9 place-items-center rounded border border-[var(--line)]" disabled={!quantities[o.id]} onClick={() => setQuantities({ ...quantities, [o.id]: Math.max(0, (quantities[o.id] ?? 0) - 1) })}><Minus size={15}/></button><output aria-label={`${o.name} 선택 수량`} className="w-7 text-center">{quantities[o.id] ?? 0}</output><button aria-label={`${o.name} 수량 추가`} className="grid h-9 w-9 place-items-center rounded border border-[var(--line)]" disabled={count >= p.maxPerAccount || (quantities[o.id] ?? 0) >= available(s, p, o.id, now)} onClick={() => setQuantities({ ...quantities, [o.id]: (quantities[o.id] ?? 0) + 1 })}><Plus size={15}/></button></div></div>)}<ErrorBox message={error}/>{existing && <Link to={`/checkout/${existing}`} className="btn w-full" onClick={onClose}>진행 중인 주문으로 이동</Link>}<InfoRow label={`총 ${count}개`} value={money(p.price * count)} strong/><InfoRow label="고정 배송비" value={money(p.shipping)}/><InfoRow label="최종 결제금액" value={money(p.price * count + p.shipping)} strong/><Button className="w-full" disabled={!count || busy || saleState(p, now) !== '판매 중'} onClick={buy}>{busy ? '재고를 확인하고 있어요…' : '구매하기 · 5분 재고 확보'}</Button><p className="muted text-[10px] leading-relaxed">선택 옵션 중 하나라도 부족하면 전체 확보에 실패합니다. 확보 시간은 새로고침·재시도로 연장되지 않습니다.</p></div></Modal>;
}

export function CheckoutPage() {
  const { id } = useParams(); const s = useStore(), now = useClock(), navigate = useNavigate(), toast = useToast(); const user = activeUser(s); const hold = s.holds.find(h => h.id === id && h.userId === user.id); const p = s.products.find(p => p.id === hold?.productId); const [terms, setTerms] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [editing, setEditing] = useState(false);
  const address = s.addresses[user.id] ?? { name: user.name, phone: user.phone, address: '', detail: '', request: '' };
  useEffect(() => { if (hold?.orderId) navigate(`/orders/${hold.orderId}?complete=1`, { replace: true }); }, [hold?.orderId, navigate]);
  if (!hold || !p) return <Empty title="진행 중인 주문이 없어요"><Link className="btn" to="/">상품 둘러보기</Link></Empty>;
  const expired = hold.status === 'released' || hold.status === 'reserved' && hold.expiresAt <= now;
  async function pay() {
    setError(''); setBusy(true);
    try {
      const latest = getState();
      if (!address.name.trim() || !address.phone.trim() || !address.address.trim()) throw new Error('배송지를 먼저 입력해 주세요.');
      await atomic(state => beginPayment(state, state.activeUserId, id!, nowOf(state)));
      await new Promise(resolve => setTimeout(resolve, 700));
      const result = await atomic(state => resolvePayment(state, state.activeUserId, id!, latest.paymentOutcome, address, nowOf(state)));
      if (result) navigate(`/orders/${result.id}?complete=1`, { replace: true });
      else if (latest.paymentOutcome === 'failure') setError('결제에 실패했어요. 남은 확보 시간 안에 다시 시도해 주세요.');
      else toast('결제 결과를 확인하고 있어요. 확인 전에는 재고를 반환하지 않습니다.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return <div className="space-y-5"><Header title="주문 / 결제" subtitle="재고 확보 성공 · 5분 안에 결제를 완료하세요"/><div className="rounded-[6px] bg-[var(--ink)] p-4 text-[var(--surface)]"><p className="mb-2 text-[11px] opacity-70">{hold.status === 'pending' ? '결제 결과 확인 중' : expired ? '확보 시간이 만료되었어요' : '선착순 재고 확보 성공'}</p><p className="font-number text-[32px] font-bold">{hold.status === 'pending' ? '확인 중' : countdown(hold.expiresAt, now)}</p><p className="mt-2 text-[10px] opacity-70">{hold.status === 'pending' ? '완료 여부 확인 전에는 재고를 반환하지 않습니다.' : '새로고침·재시도로 확보 시간이 연장되지 않습니다.'}</p></div><ProductSummary product={{ ...p, image: p.images[0] }} option={hold.lines.map(l => `${l.name} / ${l.quantity}개`).join('\n')} amount={hold.lines.reduce((n, l) => n + l.quantity * p.price, 0)}/><section className="divider space-y-3 pb-5"><div className="flex items-center justify-between"><h2 className="text-[15px] font-bold">배송지</h2><button className="text-[11px] underline" onClick={() => setEditing(true)}>수정</button></div><p className="text-[12px]">{address.name} · {address.phone}</p><p className="muted text-[12px] leading-relaxed">{address.address} {address.detail}<br/>{address.request}</p></section><div className="space-y-2"><InfoRow label="상품금액" value={money(hold.lines.reduce((n, l) => n + l.quantity * p.price, 0))}/><InfoRow label="고정 배송비" value={money(p.shipping)}/><InfoRow label="최종 결제금액" value={money(hold.lines.reduce((n, l) => n + l.quantity * p.price, 0) + p.shipping)} strong/></div><Note title="안전한 결제">선택한 상품과 최종 결제금액을 확인해 주세요. 결제 승인 후 주문이 확정됩니다.</Note><label className="flex items-start gap-3 text-[12px] leading-relaxed"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-1 h-4 w-4"/>주문 내용과 판매조건을 확인했으며 결제에 동의합니다.</label><ErrorBox message={error}/>{expired ? <Link className="btn w-full" to={`/product/${p.id}`}>상품으로 돌아가기</Link> : <Button className="w-full" disabled={busy || (!terms && hold.status !== 'pending')} onClick={pay}>{busy ? '결제 결과 확인 중…' : hold.status === 'pending' ? '결제 결과 다시 확인' : `${countdown(hold.expiresAt, now)} 안에 결제하기`}</Button>}{editing && <AddressModal initial={address} onClose={() => setEditing(false)} onSave={value => { mutate(state => { state.addresses[state.activeUserId] = value; }); setEditing(false); }}/>}</div>;
}
export function AddressModal({ initial, onClose, onSave }: { initial: Address; onClose: () => void; onSave: (value: Address) => void }) { const [value, setValue] = useState(initial); const [error, setError] = useState(''); const [searchOpen, setSearchOpen] = useState(false); return <Modal title="배송지 수정" onClose={onClose}><form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!value.name.trim() || !value.phone.trim() || !value.address.trim()) { setError('받는 분·연락처·주소를 입력해 주세요.'); return; } onSave(value); }}><Field label="배송지명"><input aria-label="배송지명" className="field" placeholder="예: 집, 회사" value={(value as any).label ?? ''} onChange={e => setValue({ ...value, label: e.target.value } as any)}/></Field><Field label="받는 분 · 필수"><input aria-label="받는 분" className="field" value={value.name} onChange={e => setValue({ ...value, name: e.target.value })} required/></Field><Field label="연락처 · 필수"><input aria-label="연락처" className="field" value={value.phone} onChange={e => setValue({ ...value, phone: e.target.value })} type="tel" required/></Field><Field label="주소 · 필수"><div className="flex gap-2"><input aria-label="주소" className="field min-w-0 flex-1" value={value.address} onChange={e => setValue({ ...value, address: e.target.value })} required/><button type="button" className="shrink-0 rounded-[4px] border border-[var(--line)] px-3 text-[11px]" onClick={() => setSearchOpen(true)}>주소 검색</button></div></Field><Field label="상세주소"><input aria-label="상세주소" className="field" value={value.detail} onChange={e => setValue({ ...value, detail: e.target.value })} placeholder="동/층/호수"/></Field><Field label="배송 요청사항"><input aria-label="배송 요청사항" className="field" value={value.request} onChange={e => setValue({ ...value, request: e.target.value })} placeholder="문 앞에 놓아주세요"/></Field><label className="flex items-start gap-3 text-[12px]"><input type="checkbox" className="mt-0.5 h-4 w-4" defaultChecked/><div><p className="font-semibold">기본 배송지로 설정</p><p className="muted text-[11px]">주문 시 이 배송지가 자동으로 선택돼요</p></div></label><ErrorBox message={error}/><Button type="submit" className="w-full">저장하기</Button></form>{searchOpen && <AddressSearchModal onClose={() => setSearchOpen(false)} onSelect={addr => { setValue({ ...value, address: addr }); setSearchOpen(false); }}/>}</Modal>; }
function AddressSearchModal({ onClose, onSelect }: { onClose: () => void; onSelect: (addr: string) => void }) { const [query, setQuery] = useState(''); return <Modal title="주소 검색" onClose={onClose}><div className="space-y-4"><input aria-label="주소 검색" className="field w-full" value={query} onChange={e => setQuery(e.target.value)} placeholder="도로명, 건물명 또는 지번으로 검색"/><button type="button" className="flex w-full items-center gap-2 rounded-[4px] bg-[var(--blue-soft)] p-3 text-[12px]">현재 위치로 주소 찾기</button><section className="space-y-3"><h3 className="text-[13px] font-bold">이렇게 검색해 보세요</h3><div><p className="text-[12px] font-semibold">도로명 + 건물번호</p><p className="muted text-[11px]">예) 와우산로 94 {'  '} 테헤란로 152</p></div><div><p className="text-[12px] font-semibold">동·읍·면 + 지번</p><p className="muted text-[11px]">예) 서교동 338-1 {'  '} 역삼동 737</p></div><div><p className="text-[12px] font-semibold">건물명·아파트명</p><p className="muted text-[11px]">예) 강남파이낸스센터 {'  '} 판교 푸르지오</p></div></section><p className="muted text-[10px]">결과가 없으면 띄어쓰기를 바꾸거나 건물번호를 빼고 검색해 보세요.</p></div></Modal>; }

export function OrdersPage() {
  const s = useStore(), now = useClock(); const [tab, setTab] = useState('전체'); const orders = s.orders.filter(o => o.userId === s.activeUserId); const activeHolds = s.holds.filter(h => h.userId === s.activeUserId && (h.status === 'pending' || h.status === 'reserved' && h.expiresAt > now)); const tabs = ['전체', '배송 준비', '배송 중', '배송 완료', '취소·환불'];
  const filtered = orders.filter(o => tab === '전체' || tab === '배송 준비' && ['paid', 'preparing'].includes(o.status) || ORDER_LABELS[o.status] === tab || tab === '취소·환불' && ['cancelled', 'refunded'].includes(o.status));
  return <><Header title="주문 · 배송" subtitle="주문 상세와 배송 조회를 구분해서 확인하세요." back={false}/>{activeHolds.map(h => <Link key={h.id} to={`/checkout/${h.id}`} className="mb-4 block rounded-[4px] bg-[var(--blue-soft)] p-4"><b className="text-[12px]">{h.status === 'pending' ? '결제 결과 확인 중' : '확보한 주문 이어서 결제'}</b><p className="muted mt-2 text-[11px]">{s.products.find(p => p.id === h.productId)?.name} · {h.status === 'pending' ? '결제 완료 여부를 확인해 주세요.' : `${countdown(h.expiresAt, now)} 남음`} ›</p></Link>)}<div className="divider flex justify-between gap-1 pb-2">{tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-2 text-[10px] ${tab === t ? 'border-[var(--ink)] font-bold' : 'muted border-transparent'}`}>{t}</button>)}</div>{filtered.map(o => <article key={o.id} className="divider space-y-4 py-5"><div className="flex items-center justify-between"><span className="muted max-w-[235px] truncate text-[10px]">{o.id}</span><Badge live={['shipping', 'delivered'].includes(o.status)}>{ORDER_LABELS[o.status]}</Badge></div><ProductSummary product={o.product} option={o.lines.map(l => `${l.name} ${l.quantity}개`).join(' · ')} amount={o.total}/><div className="grid grid-cols-2 gap-2"><Link className="btn" to={`/orders/${o.id}${['shipping', 'delivered'].includes(o.status) ? '?tracking=1' : ''}`}>{['shipping', 'delivered'].includes(o.status) ? '배송 조회' : '주문 상세'}</Link><Link className="btn btn-outline" to={`/orders/${o.id}`}>{['shipping', 'delivered'].includes(o.status) ? '주문 상세' : '판매자 문의'}</Link></div></article>)}{!filtered.length && <Empty title="주문 내역이 없어요"><Link className="btn" to="/">상품 둘러보기</Link></Empty>}</>;
}

export function OrderDetailPage() {
  const { id } = useParams(); const [params, setParams] = useSearchParams(); const s = useStore(), user = activeUser(s); const o = s.orders.find(o => o.id === id && o.userId === user.id); const [contact, setContact] = useState(false); const complete = params.has('complete'), tracking = params.has('tracking');
  if (!o) return <Empty title="주문을 찾을 수 없어요"><Link to="/orders" className="btn">주문 목록</Link></Empty>;
  const events: [number, string, string][] = [...(o.processedAt ? [[o.processedAt, '배송 완료 · 판매자 등록', o.deliveredPlace ?? '수령 완료'] as [number, string, string]] : []), ...(o.shippedAt ? [[o.shippedAt, '택배사 인수 · 배송 중', o.carrier ?? ''] as [number, string, string]] : []), [o.createdAt, '결제 완료', '주문이 확정되었어요']];
  return <div className="space-y-5"><Header title={complete ? '주문 완료' : '주문 · 배송 상세'} subtitle={o.id}/>{complete ? <div className="space-y-4"><p className="muted text-[11px]">배송이 곧 시작돼요</p><p className="muted text-[10px]">배송이 시작되면 알려드릴게요</p><CheckCircle2 size={38} className="text-[var(--green)]"/><h1 className="text-[25px] font-bold">축하해요!</h1><p className="text-[14px]">선착순 구매에 성공했어요</p></div> : <><h2 className="text-[24px] font-bold tracking-[-.7px]">{o.status === 'delivered' ? '상품 배송이 완료되었어요' : o.status === 'shipping' ? '상품이 고객님께 가고 있어요' : ['cancelled', 'refunded'].includes(o.status) ? ORDER_LABELS[o.status] : o.status === 'preparing' ? '상품을 준비하고 있어요' : '결제가 완료되었어요'}</h2><DeliveryProgress status={o.status}/></>}
    <ProductSummary product={o.product} option={o.lines.map(l => `${l.name} / ${l.quantity}개`).join('\n')} amount={o.lines.reduce((n, l) => n + l.quantity * o.product.price, 0)}/>
    {o.status === 'delivered' ? <Note title={dateTime(o.deliveredAt ?? o.createdAt)} green><p className="mb-2">수령 장소 · {o.deliveredPlace}</p>판매자 수동 처리 · {dateTime(o.processedAt ?? o.createdAt)} 등록<br/>택배사 자동 확인 또는 구매확정이 아닙니다.</Note> : o.status === 'shipping' ? <Note title="상품이 배송 중입니다">택배사 · {o.carrier}<br/>운송장 번호 {o.tracking}</Note> : <Note title="판매자가 상품을 준비하고 있어요">운송장이 등록되면 배송 정보를 확인할 수 있습니다.</Note>}
    <section className="space-y-2"><h3 className="mb-3 text-[15px] font-bold">{tracking ? '배송 정보' : '주문 및 결제 정보'}</h3>{o.tracking && <><InfoRow label="택배사" value={o.carrier}/><InfoRow label="운송장 번호" value={<span className="inline-flex items-center gap-1">{o.tracking}<CopyButton value={o.tracking}/></span>}/></>}<InfoRow label="상품금액" value={money(o.total - o.shipping)}/><InfoRow label="고정 배송비" value={money(o.shipping)}/><InfoRow label="최종 결제금액" value={money(o.total)} strong/><InfoRow label="결제 방법" value="카드 결제"/></section>
    <section className="divider space-y-3 py-4"><h3 className="text-[15px] font-bold">배송지</h3><p className="text-[12px]">{o.address.name} · {o.address.phone}</p><p className="muted text-[12px] leading-relaxed">{o.address.address} {o.address.detail}<br/>{o.address.request}</p></section>
    {!complete && <section><h3 className="mb-3 text-[15px] font-bold">주문 진행 내역</h3>{events.map(([time, title, desc], i) => <div key={i} className="divider flex gap-3 py-3"><PackageCheck size={17} className={i ? 'muted' : 'text-[var(--green)]'}/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><b className="text-[12px]">{title}</b><span className="muted text-[10px]">{dateTime(time)}</span></div><p className="muted mt-1 text-[11px]">{desc}</p></div></div>)}</section>}
    <Note title="상품을 확인해 주세요">취소·반품·하자·오배송은 판매자에게 문의해 주세요. 교환은 지원하지 않습니다.</Note><Button outline className="w-full" onClick={() => setContact(true)}>판매자 문의 · 반품 문의</Button>{complete ? <><Link className="btn w-full" to="/">쇼핑 계속하기</Link><Button outline className="w-full" onClick={() => setParams({})}>상세 배송조회</Button></> : <Link className="btn w-full" to="/orders">주문 목록으로</Link>}{contact && <OrderContactModal order={o} onClose={() => setContact(false)}/>}
  </div>;
}
function OrderContactModal({ order, onClose }: { order: Order; onClose: () => void }) { const toast = useToast(); const [kind, setKind] = useState('배송 문의'), [question, setQuestion] = useState(''), [error, setError] = useState(''); return <Modal title="판매자에게 문의" onClose={onClose}><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!question.trim()) { setError('문의 내용을 입력해 주세요.'); return; } try { mutate(s => { s.inquiries.unshift({ id: uid('q-'), userId: s.activeUserId, sellerId: order.sellerId, productId: order.productId, orderId: order.id, productName: order.product.name, kind, question: question.trim(), public: false, createdAt: nowOf(s) }); }); toast('문의가 판매자에게 전달되었습니다.'); onClose(); } catch (e) { setError((e as Error).message); } }}><Field label="문의 유형"><select aria-label="문의 유형" className="field" value={kind} onChange={e => setKind(e.target.value)}>{['배송 문의', '주문 취소', '반품', '하자', '오배송'].map(k => <option key={k}>{k}</option>)}</select></Field><Note title={order.product.name}>{order.lines.map(l => `${l.name} ${l.quantity}개`).join(' · ')}</Note><Field label="문의 내용"><textarea aria-label="문의 내용" className="field field-box" value={question} onChange={e => setQuestion(e.target.value)} maxLength={1500} required/></Field><p className="muted text-[10px]">주문 관련 문의는 AI를 거치지 않고 판매자에게 전달됩니다.</p><ErrorBox message={error}/><Button type="submit" className="w-full">문의 보내기</Button></form></Modal>; }

interface ChatMessage { role: 'buyer' | 'ai'; text: string; source?: string; forward?: boolean }
export function QaPage() {
  const { id } = useParams(); const [params] = useSearchParams(); const s = useStore(), toast = useToast(), p = s.products.find(p => p.id === id); const [question, setQuestion] = useState(''), [messages, setMessages] = useState<ChatMessage[]>([]), [busy, setBusy] = useState(false);
  if (!p) return <Empty title="상품을 찾을 수 없어요"/>;
  const myInquiries = s.inquiries.filter(q => q.userId === s.activeUserId && q.productId === p.id);
  function forward(text: string) { if (myInquiries.some(q => q.question === text && !q.answer)) { toast('이미 판매자에게 전달한 문의입니다.'); return; } mutate(state => { state.inquiries.unshift({ id: uid('q-'), userId: state.activeUserId, sellerId: p!.sellerId, productId: p!.id, productName: p!.name, kind: '상품 문의', question: text, public: false, createdAt: nowOf(state) }); }); toast('질문을 판매자에게 전달했습니다.'); }
  async function ask(e: React.FormEvent) { e.preventDefault(); const text = question.trim(); if (!text || busy) return; setQuestion(''); setMessages(m => [...m, { role: 'buyer', text }]); if (params.has('direct') || /취소|반품|하자|오배송/.test(text)) { forward(text); setMessages(m => [...m, { role: 'ai', text: '질문을 판매자에게 직접 전달했습니다.' }]); return; } setBusy(true); await new Promise(resolve => setTimeout(resolve, 500)); const tokens = text.replace(/[?？\s]/g, ''); const conflict = /충돌|다르|일치하지|상이/.test(text) || p!.extras.some(e => text.includes(e.key) && p!.extras.some(other => other.key === e.key && other.value !== e.value)); const match = conflict ? undefined : p!.faqs.filter(f => f.confirmed).find(f => f.question === text || (tokens.length > 3 && f.question.replace(/[?？\s]/g, '').includes(tokens)) || /페이지/.test(text) && /페이지/.test(f.question) || /지퍼/.test(text) && /지퍼/.test(f.question) || /외부.*치수|치수/.test(text) && /치수/.test(f.question) || /단면|실측/.test(text) && /단면/.test(f.question)); const extra = conflict ? undefined : p!.extras.find(ex => text.includes(ex.key) && ex.key.length > 1); setMessages(m => [...m, match ? { role: 'ai', text: match.answer, source: '근거: 판매자 확인 FAQ' } : extra ? { role: 'ai', text: extra.value, source: `근거: 등록 상품정보 · ${extra.key}` } : { role: 'ai', text: '등록된 정보만으로는 확인하기 어려워요. 판매자에게 질문을 전달할까요?', forward: true }]); setBusy(false); }
  return <div className="space-y-4"><Header title={params.has('direct') ? '판매자 문의' : 'AI 상품 Q&A'} subtitle="상품정보와 판매자 확인 FAQ를 바탕으로 답변합니다."/><ProductSummary product={{ ...p, image: p.images[0] }} amount={p.price}/><Note>추가 확인이 필요한 내용은 판매자에게 문의해 주세요. 기존 판매처의 가격과 판매조건은 직접 확인해 주세요.</Note>{!params.has('direct') && p.faqs.filter(f => f.confirmed).length > 0 && <div className="rounded-[4px] bg-[var(--blue-soft)] p-3"><p className="text-[11px] font-bold">AI 분석 완료</p><p className="muted mt-1 text-[10px]">등록한 사진 {p.images.length}장을 분석했어요</p></div>}<div className="flex flex-wrap gap-2">{p.faqs.filter(f => f.confirmed).map(f => <button key={f.id} className="rounded-[4px] border border-[var(--line)] px-2.5 py-2 text-left text-[11px]" onClick={() => { setMessages(m => [...m, { role: 'buyer', text: f.question }, { role: 'ai', text: f.answer, source: '근거: 판매자 확인 FAQ' }]); }}>{f.question}</button>)}</div>{messages.map((m, i) => <div key={i} className={`max-w-[94%] rounded-[6px] p-3 text-[12px] leading-[1.8] ${m.role === 'buyer' ? 'ml-auto bg-[var(--ink)] text-[var(--surface)]' : 'divider bg-[var(--blue-soft)]'}`}><p>{m.text}</p>{m.source && <p className="muted mt-2 text-[10px]">{m.source}</p>}{m.forward && <Button className="mt-3 w-full" onClick={() => forward(messages[i - 1]?.text ?? '')}>판매자에게 전달</Button>}</div>)}{busy && <p className="muted text-[12px]">등록 정보를 확인하고 있어요…</p>}{myInquiries.map(q => <div key={q.id} className="space-y-3"><Note title={q.answer ? '판매자 답변' : '판매자 답변 대기'}>{q.question}{q.answer && <p className="mt-3 whitespace-pre-line text-[var(--ink)]">{q.answer}</p>}</Note></div>)}<form onSubmit={ask} className="sticky bottom-[78px] flex gap-2 border-t border-[var(--line)] bg-[var(--surface)] py-3"><input aria-label="상품 질문" value={question} onChange={e => setQuestion(e.target.value)} placeholder="상품 정보를 질문해 보세요" className="field min-w-0 flex-1" maxLength={500}/><Button type="submit" disabled={busy || !question.trim()}>보내기</Button></form></div>;
}

export function CalendarPage() {
  const s = useStore(), now = useClock();
  const [viewDate, setViewDate] = useState(() => new Date(now));
  const year = viewDate.getFullYear(), month = viewDate.getMonth();
  const published = s.products.filter(p => p.published);
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Monday-based
  const totalCells = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
  const cells = Array.from({ length: totalCells }, (_, i) => {
    const d = i - startOffset + 1;
    return d >= 1 && d <= lastDay.getDate() ? d : null;
  });
  function hasSale(day: number) {
    const start = new Date(year, month, day).getTime();
    const end = start + 86_400_000;
    return published.some(p => p.startsAt >= start && p.startsAt < end);
  }
  function salesOnDay(day: number) {
    const start = new Date(year, month, day).getTime();
    const end = start + 86_400_000;
    return published.filter(p => p.startsAt >= start && p.startsAt < end);
  }
  const today = new Date(now);
  const isToday = (day: number) => day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  const [selected, setSelected] = useState<number | null>(null);
  const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
  const nextMonth = () => setViewDate(new Date(year, month + 1, 1));
  const selectedSales = selected ? salesOnDay(selected) : [];
  return (
    <div className="space-y-4">
      <Header title="전체 일정" subtitle="판매 있는 날 · 오늘 · 이번 주 일정은 다음 주까지 공개돼요" back={true}/>
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button type="button" onClick={prevMonth} className="muted px-2 py-2 text-[11px]">← 이전달</button>
          <b className="text-[13px]">{year}년 {month + 1}월</b>
          <button type="button" onClick={nextMonth} className="muted px-2 py-2 text-[11px]">다음달 →</button>
        </div>
        <div className="grid grid-cols-7 gap-0">
          {['월','화','수','목','금','토','일'].map(d => (
            <div key={d} className="py-2 text-center text-[11px] font-semibold text-[var(--muted)]">{d}</div>
          ))}
          {cells.map((day, i) => (
            <button
              key={i}
              type="button"
              disabled={!day}
              onClick={() => day && setSelected(selected === day ? null : day)}
              className={`relative flex flex-col items-center py-2 text-[12px] ${!day ? '' : 'hover:bg-[var(--blue-soft)]'} ${day && isToday(day) ? 'font-bold text-[var(--red)]' : ''} ${day && selected === day ? 'rounded bg-[var(--ink)] text-[var(--surface)]!' : ''}`}
            >
              {day && <span>{day}</span>}
              {day && hasSale(day) && (
                <span className={`mt-0.5 h-1 w-1 rounded-full ${selected === day ? 'bg-[var(--surface)]' : 'bg-[var(--ink)]'}`}/>
              )}
            </button>
          ))}
        </div>
      </div>
      {selected && (
        <div className="space-y-2">
          <h2 className="text-[14px] font-bold">{month + 1}월 {selected}일 판매 일정</h2>
          {selectedSales.length ? selectedSales.map(p => (
            <Link key={p.id} to={`/product/${p.id}`} className="divider flex items-center gap-3 py-3">
              <Calendar size={16} className="muted shrink-0"/>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-semibold">{p.brand}</p>
                <p className="muted text-[11px]">{p.name}</p>
              </div>
              <ChevronRight size={16} className="muted shrink-0"/>
            </Link>
          )) : <p className="muted text-[12px]">이 날에 예정된 판매가 없어요.</p>}
        </div>
      )}
      <p className="muted text-[10px]">판매 상품 확인하기 버튼을 눌러 상세 일정을 확인하세요.</p>
    </div>
  );
}

interface Notification { id: string; type: '구매' | '상품' | '맞춤추천'; title: string; desc: string; time: string }
const DEMO_NOTIFICATIONS: Notification[] = [
  { id: 'n1', type: '맞춤추천', title: '맞춤 추천', desc: '회원님이 좋아할 것 같은 소프트 코튼 가디건이 판매 중이에요.', time: '2분 전' },
  { id: 'n2', type: '상품', title: '판매 시작', desc: "천한 상품 '린넨 와이드 슬랙스'의 판매가 막 시작됐어요.", time: '1시간 전' },
  { id: 'n3', type: '상품', title: '재고 임박', desc: '관심 상품의 재고가 얼마 남지 않았어요. 지금 확인해보세요.', time: '어제' },
  { id: 'n4', type: '구매', title: '구매 확정', desc: '소프트 코튼 가디건 주문이 확정되었습니다.', time: '2일 전' },
  { id: 'n5', type: '맞춤추천', title: '맞춤 추천', desc: '새 미판매 상품이 등록됐어요. 한정 수량이니 서둘러 확인하세요.', time: '3일 전' },
];

export function NotificationsPage() {
  const [tab, setTab] = useState<'전체' | '구매' | '상품' | '맞춤추천'>('전체');
  const tabs = ['전체', '구매', '상품', '맞춤추천'] as const;
  const filtered = tab === '전체' ? DEMO_NOTIFICATIONS : DEMO_NOTIFICATIONS.filter(n => n.type === tab);
  return (
    <div className="space-y-4">
      <Header title="알림" back={true}/>
      <div className="divider flex gap-5 pb-2">
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-2 text-[12px] ${tab === t ? 'border-[var(--ink)] font-bold' : 'muted border-transparent'}`}>{t}</button>
        ))}
      </div>
      {filtered.length ? filtered.map(n => (
        <article key={n.id} className="divider py-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className="rounded bg-[var(--blue-soft)] px-2 py-0.5 text-[10px] font-semibold">{n.type}</span>
            <span className="muted text-[10px]">{n.time}</span>
          </div>
          <p className="text-[13px] font-semibold">{n.title}</p>
          <p className="muted text-[12px] leading-relaxed">{n.desc}</p>
        </article>
      )) : (
        <Empty title="새로운 알림이 없어요" message="관심 상품을 저장하면 맞춤 알림을 받을 수 있어요."/>
      )}
    </div>
  );
}
