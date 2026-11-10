import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, Bell, ExternalLink, Bookmark, Clock3, Plus, Minus, Truck, CheckCircle2, ChevronRight, PackageCheck, Calendar } from 'lucide-react';
import { Badge, BottomSheet, Button, Chip, CopyButton, DeliveryProgress, Empty, ErrorBox, Field, Header, InfoRow, Modal, Note, ORDER_LABELS, ProductCard, ProductImage, ProductSummary, useToast } from '../components/ui';
import { activeUser, available, beginPayment, DomainError, money, nowOf, reserve, resolvePayment, saleState, uid } from '../domain';
import type { Address, Hold, Product, Order } from '../domain';
import { atomic, getState, mutate, useStore } from '../store';
import { externalHref } from '../files';
import { countdown, dateTime, shortDate, useClock } from '../hooks';
import { loginHref, signedIn } from '../auth';
import { listAddresses, toAddress } from './address';
import type { SavedAddress } from './address';

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
    {showHero && (() => { const urgent = s.products.filter(p => p.published && saleState(p, now) === '판매 중' && p.endsAt - now <= 3_600_000); return urgent.length > 0 ? <section className="space-y-3"><div className="flex items-center justify-between"><h2 className="text-[20px] font-bold">곧 마감돼요</h2><span className="rounded-[4px] bg-[var(--red)] px-2 py-0.5 text-[11px] font-semibold text-white">마감 임박 {urgent.length}</span></div>{urgent.map(p => { const totalStock = p.options.reduce((n, o) => n + o.stock, 0); const avail = p.options.reduce((n, o) => n + available(s, p, o.id, now), 0); const sold = totalStock - avail; return <Link key={p.id} to={`/product/${p.id}`} className="divider flex items-center gap-3 py-3"><ProductImage src={p.images[0]} alt={p.name} className="h-[64px] w-[64px] shrink-0"/><div className="min-w-0 flex-1 space-y-1"><p className="text-[13px] font-semibold">{p.name}</p><p className="font-number text-[13px] font-bold">{money(p.price)}</p><div className="flex items-center justify-between"><p className="text-[13px] font-bold text-[var(--red)]">서두르세요! {avail}개 남았어요</p><p className="text-[12px] text-[var(--muted)]">{totalStock}개 중 {sold}개 판매</p></div><div className="mt-1 h-1 w-full rounded-full bg-[var(--line)]"><div className="h-1 rounded-full bg-[var(--red)]" style={{ width: `${Math.max(0, Math.min(100, (sold / totalStock) * 100))}%` }}/></div></div></Link>; })}</section> : null; })()}
    <div className="flex items-end justify-between pt-4"><div><h2 className="text-[20px] font-bold">{query ? `검색 결과 ${products.length}개` : '새로 올라온 상품'}</h2><p className="muted mt-1 text-[11px]">의류 · 패션잡화 · 문구 · 생활잡화</p></div>{showHero && <button className="muted text-[11px]" onClick={() => setParam('state', '판매 예정')}>더보기</button>}</div>
    {products.length ? <div className="grid grid-cols-2 gap-x-2 gap-y-6">{products.map(p => <ProductCard key={p.id} product={p} now={now} availableCount={p.options.reduce((n, o) => n + available(s, p, o.id, now), 0)}/>)}</div> : <Empty title="검색 결과가 없어요" message="검색어나 카테고리를 바꿔 보세요."><Button outline onClick={() => setParams({})}>필터 초기화</Button></Empty>}
    <p className="muted py-4 text-[10px]">미판매 새 상품만 판매합니다. 중고·전시·하자 상품은 제외돼요.</p>
  </div>;
}

export function SchedulePage() {
  const s = useStore(), now = useClock(); const [selected, setSelected] = useState('전체'); const [weekOffset, setWeekOffset] = useState<0 | 1>(0);
  const [notifiedIds, setNotifiedIds] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('stockdrop:notified-products') || '[]'); } catch { return []; } });
  const toggleNotify = (id: string) => setNotifiedIds(prev => { const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; try { localStorage.setItem('stockdrop:notified-products', JSON.stringify(next)); } catch {} return next; });
  const products = s.products.filter(p => p.published && p.endsAt > now).sort((a, b) => a.startsAt - b.startsAt);
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const monday = new Date(today); monday.setDate(today.getDate() - (today.getDay() + 6) % 7 + weekOffset * 7);
  const weekEnd = new Date(monday); weekEnd.setDate(monday.getDate() + 7);
  const week = Array.from({ length: 7 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return { key: shortDate(date.getTime()), weekday: ['월', '화', '수', '목', '금', '토', '일'][index], date: `${date.getMonth() + 1}.${date.getDate()}` }; });
  const visible = products.filter(p => selected === '전체' ? p.startsAt >= monday.getTime() && p.startsAt < weekEnd.getTime() : shortDate(p.startsAt) === selected);
  const moveWeek = (offset: 0 | 1) => { setWeekOffset(offset); setSelected('전체'); };
  return <><Header title="판매 일정" subtitle="모든 판매는 오픈 후 3시간 동안만 진행돼요" back={false}/><div className="mb-6 space-y-2"><div className="flex items-center justify-between"><div className="flex gap-2"><button type="button" onClick={() => moveWeek(0)} className={`px-2 py-2 text-[11px] ${weekOffset === 0 ? 'font-bold' : 'muted'}`}>이번 주</button><button type="button" onClick={() => moveWeek(1)} className={`px-2 py-2 text-[11px] ${weekOffset === 1 ? 'font-bold' : 'muted'}`}>다음 주</button></div><div className="flex items-center gap-2"><span className="muted text-[11px]">{week[0]?.date} – {week[6]?.date}</span><Link to="/schedule/calendar" className="text-[11px] underline">전체 일정</Link></div></div><button onClick={() => setSelected('전체')} className={`w-full rounded-[4px] py-2 text-[12px] ${selected === '전체' ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--blue-soft)]'}`}>전체</button><div className="grid grid-cols-7 gap-1">{week.map(day => <button key={day.key} onClick={() => setSelected(day.key)} aria-label={`${day.key} ${day.weekday}요일`} className={`flex min-w-0 flex-col items-center rounded-[4px] px-1 py-2 ${selected === day.key ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--blue-soft)]'}`}><b className="text-[12px]">{day.weekday}</b><span className="mt-1 text-[9px] opacity-70">{day.date}</span></button>)}</div></div>{selected !== '전체' && (() => { const selDate = new Date(selected); const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']; return <div className="flex items-center justify-between py-2"><h2 className="text-[14px] font-bold">{selDate.getMonth() + 1}월 {selDate.getDate()}일 {dayNames[selDate.getDay()]}</h2><span className="muted text-[11px]">판매 {visible.length}개</span></div>; })()}{(() => { const selling = visible.filter(p => saleState(p, now) === '판매 중'); const upcoming = visible.filter(p => saleState(p, now) === '판매 예정'); const groups: [string, number, typeof visible][] = []; if (selling.length) groups.push(['지금 판매 중', selling.length, selling]); if (upcoming.length) groups.push(['오픈 예정', upcoming.length, upcoming]); const other = visible.filter(p => !['판매 중', '판매 예정'].includes(saleState(p, now))); if (other.length) groups.push(['판매 종료', other.length, other]); return groups.length ? groups.map(([label, count, items]) => <section key={label}><div className="flex items-center gap-2 py-3"><h3 className="text-[13px] font-bold">{label}</h3><span className="muted text-[11px]">{count}</span></div>{items.map(p => { const state = saleState(p, now); const timeLabel = state === '판매 중' ? `${new Date(p.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} – ${new Date(p.endsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}` : `${new Date(p.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 오픈`; return <Link key={p.id} to={`/product/${p.id}`} className="divider flex items-center gap-3 py-4"><ProductImage src={p.images[0]} alt={p.name} className="h-[72px] w-[72px]"/><div className="min-w-0 flex-1 space-y-1"><div className="flex items-center gap-2"><Badge live={state === '판매 중'}>{state === '판매 예정' ? '오픈 예정' : state}</Badge><span className="muted text-[10px]">{timeLabel}</span></div><h2 className="text-[14px] font-semibold">{p.name}</h2><p className="muted text-[10px]">{p.category}</p><div className="flex items-center justify-between"><span className="font-number text-[13px] font-bold">{money(p.price)}</span>{state === '판매 예정' ? <button onClick={e => { e.preventDefault(); toggleNotify(p.id); }} className={`rounded-[4px] px-2 py-0.5 text-[10px] font-semibold border ${notifiedIds.includes(p.id) ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)]' : 'border-[var(--line)]'}`}>{notifiedIds.includes(p.id) ? '알림 설정됨' : '알림 받기'}</button> : <span className="muted text-[10px]">{state === '판매 중' ? `${countdown(p.endsAt, now)} 남음` : ''}</span>}</div></div></Link>; })}</section>) : <Empty title="선택한 날의 판매 일정이 없어요" message="다른 요일을 선택하거나 전체 일정을 확인해 보세요."/>; })()}</>;
}

export function ProductPage() {
  const { id } = useParams(); const s = useStore(), now = useClock(), toast = useToast(); const p = s.products.find(p => p.id === id); const navigate = useNavigate(); const [optionsOpen, setOptionsOpen] = useState(false); const [extPopup, setExtPopup] = useState(false); const [selectedFaq, setSelectedFaq] = useState<string | null>(null);
  if (!p || !p.published) return <Empty title="상품을 찾을 수 없어요"><Link to="/" className="btn">홈으로</Link></Empty>;
  const status = saleState(p, now), qty = p.options.reduce((n, o) => n + available(s, p, o.id, now), 0), saved = s.bookmarks.includes(`${s.activeUserId}:${p.id}`);
  const bookmark = () => mutate(state => { const key = `${state.activeUserId}:${p.id}`; state.bookmarks = saved ? state.bookmarks.filter(k => k !== key) : [...state.bookmarks, key]; });
  const [notified, setNotified] = useState(() => { try { return JSON.parse(localStorage.getItem('stockdrop:notified-products') || '[]').includes(p.id); } catch { return false; } });
  const toggleNotify = () => { setNotified((v: boolean) => { const next = !v; try { const all = JSON.parse(localStorage.getItem('stockdrop:notified-products') || '[]'); localStorage.setItem('stockdrop:notified-products', JSON.stringify(next ? [...all, p.id] : all.filter((x: string) => x !== p.id))); } catch {} return next; }); };
  const headerTitle = status === '판매 예정' ? '판매 대기' : status === '판매 종료' && qty <= 0 ? '구매 결과' : '상품 상세';
  return <div className="space-y-4"><Header title={headerTitle} subtitle={status === '판매 예정' ? '오픈 예정' : '결제가 완료된 주문부터 확정돼요'} action={<button aria-label={saved ? '관심 상품 해제' : '관심 상품 저장'} onClick={() => { if (!signedIn(s)) { navigate(loginHref(`/product/${p.id}`)); return; } bookmark(); toast(saved ? '관심 상품에서 해제했습니다.' : '관심 상품에 저장했습니다.'); }} className="grid h-9 w-9 place-items-center"><Bookmark size={20} fill={saved ? 'currentColor' : 'none'}/></button>}/><ProductImage src={p.images[0]} alt={p.name} className="aspect-square w-full rounded-none!"/>
    <div className="flex items-center justify-between gap-3"><Badge live={status === '판매 중'}>{status === '판매 예정' ? '오픈 예정' : status}</Badge><p className="text-[11px] text-[var(--red)]">{status === '판매 중' ? `마감까지 ${countdown(p.endsAt, now)}` : status === '판매 예정' ? `${p.category} · 3시간 한정` : '신규 구매가 종료되었어요'}</p></div>
    {status === '판매 예정' && <div className="space-y-3"><div className="rounded-[4px] bg-[var(--blue-soft)] p-5 text-center"><p className="muted mb-2 text-[11px]">판매 시작까지</p><p className="font-number text-[32px] font-bold">{countdown(p.startsAt, now)}</p><p className="muted mt-2 text-[10px]">{dateTime(p.startsAt)} 오픈</p></div><button onClick={toggleNotify} className={`flex w-full items-center justify-between rounded-[6px] border px-4 py-3 text-left ${notified ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)]' : 'border-[var(--line)]'}`}><div><p className="text-[13px] font-bold">판매 시작 알림 신청</p><p className={`mt-0.5 text-[11px] ${notified ? 'opacity-70' : 'muted'}`}>판매 시작 시 즉시 알림을 보내드려요</p></div><span className={`text-[11px] font-semibold ${notified ? '' : 'text-[var(--muted)]'}`}>{notified ? '알림 설정됨' : '신청하기'}</span></button></div>}
    {status === '판매 종료' && qty <= 0 && <div className="space-y-3 rounded-[4px] bg-[var(--blue-soft)] p-5 text-center"><p className="font-number text-[28px] font-extrabold tracking-[-1px]">SOLD OUT</p><p className="text-[14px] font-bold">선착순 판매 종료됐어요</p><p className="muted text-[11px]">선착순 마감되었습니다. 다음 판매를 노려보세요</p></div>}
    <Note title={status === '판매 예정' ? '게시 즉시 공개 · 구매는 시작 시각부터' : '3시간 한정 선착순'}>{status === '판매 예정' ? '판매 시작 전에는 탐색과 Q&A만 가능합니다. 구매하거나 재고를 확보할 수 없습니다.' : '옵션 선택은 재고 확보가 아닙니다. 구매하기로 확보에 성공하면 5분 안에 결제를 완료해 주세요.'}</Note>
    <p className="text-[12px] font-bold">{p.category} · {p.brand}</p><h1 className="text-[22px] tracking-[-.5px]">{p.name}</h1><p className="muted text-[10px]">미판매 새 상품 · 중고·전시·하자 상품 제외</p>
    <button className="divider flex w-full items-center gap-3 py-3 text-left" onClick={() => setExtPopup(true)}><ExternalLink size={18}/><div><p className="text-[12px] font-semibold">기존 판매처에서 상품 보기</p><p className="muted mt-1 text-[10px]">외부 판매처의 가격과 판매조건은 직접 확인해 주세요.</p></div></button>
    <div><p className="font-number text-[24px] font-bold">{money(p.price)}</p><p className="muted mt-2 text-[11px]">고정 배송비 {money(p.shipping)} · 최종 결제금액은 수량 선택 후 표시</p></div>
    <div className="divider space-y-2 py-4"><InfoRow label="판매 시작" value={dateTime(p.startsAt)}/><InfoRow label="판매 종료" value={`${dateTime(p.endsAt)} · 3시간 후 자동 종료`}/><InfoRow label="출고 예정" value={`결제 후 ${p.dispatchDays}영업일 이내`}/><InfoRow label="계정당 구매 상한" value={`최대 ${p.maxPerAccount}개`}/></div>
    <h2 className="text-[15px] font-bold">옵션별 구매 가능 수량</h2>{p.options.map(o => <div key={o.id} className="divider flex items-center justify-between gap-3 py-3"><span className="text-[13px]">{o.name}</span><span className="text-[12px] text-[var(--green)]">{status === '판매 중' ? `${available(s, p, o.id, now)}개` : status === '판매 예정' ? '판매 시작 후 구매 가능' : '판매 종료'}</span></div>)}
    <section className="space-y-3 py-3"><h2 className="text-[15px] font-bold">상품 정보</h2><p className="whitespace-pre-line text-[12px] leading-[1.8]">{p.description}</p>{p.extras.map((e, i) => <InfoRow key={i} label={e.key} value={e.value}/>)}<InfoRow label="재고 처분 사유" value={p.reason}/></section>
    {(() => { const faqs = p.faqs.filter(f => f.confirmed); const sel = faqs.find(f => f.id === selectedFaq); return faqs.length ? <section className="divider space-y-3 py-4"><h2 className="text-[15px] font-bold">판매자 확인 FAQ</h2><div className="flex flex-wrap gap-2">{faqs.map(f => <button key={f.id} onClick={() => setSelectedFaq(selectedFaq === f.id ? null : f.id)} className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition-colors ${selectedFaq === f.id ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--surface)]' : 'border-[var(--line)]'}`}>{f.question}</button>)}</div>{sel && <div className="rounded-[6px] bg-[var(--blue-soft)] p-3"><p className="text-[11px] font-semibold">A.</p><p className="mt-1 whitespace-pre-line text-[12px] leading-relaxed">{sel.answer}</p></div>}</section> : null; })()}
<p className="muted text-[10px] leading-relaxed">교환은 지원하지 않습니다. 취소·반품·하자·오배송은 주문 내역에서 판매자에게 문의해 주세요.</p>
    {status === '판매 종료' && qty <= 0 && <section className="space-y-3"><h2 className="text-[15px] font-bold">놓친 상품과 비슷한 상품</h2><div className="grid grid-cols-2 gap-x-2 gap-y-4">{s.products.filter(r => r.published && r.id !== p.id && r.category === p.category && r.endsAt > now).slice(0, 4).map(r => <ProductCard key={r.id} product={r} now={now}/>)}</div>{s.products.some(r => r.published && r.id !== p.id && r.category === p.category && r.endsAt > now) && <Link className="btn btn-outline w-full" to={`/?category=${encodeURIComponent(p.category.split(' > ')[0])}`}>전체보기</Link>}</section>}
    <div className="sticky bottom-[76px] z-20 -mx-4 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3">{status === '판매 종료' && qty <= 0 ? <div className="flex gap-2"><Link className="btn flex-1" to="/">홈으로</Link><Link className="btn btn-outline flex-1" to={`/?category=${encodeURIComponent(p.category.split(' > ')[0])}`}>비슷한 상품 보기</Link></div> : <Button buy className="w-full" disabled={status !== '판매 중' || qty <= 0} onClick={() => signedIn(s) ? setOptionsOpen(true) : navigate(loginHref(`/product/${p.id}`))}>{status === '판매 예정' ? '판매 시작 전 · 구매할 수 없어요' : status === '판매 종료' ? '판매가 종료되었습니다' : qty <= 0 ? '일시 품절 · 재고를 확인해 주세요' : `남은 ${qty}개 · 선착순 구매하기`}</Button>}</div>
    {optionsOpen && <OptionSheet product={p} onClose={() => setOptionsOpen(false)}/>}
    {extPopup && <Modal title="외부 사이트로 이동할까요?" onClose={() => setExtPopup(false)}><div className="space-y-4"><p className="muted text-[12px]">STOCKDROP을 벗어나 판매처 페이지가 새 창으로 열려요.</p><div className="rounded-[4px] bg-[var(--blue-soft)] p-3"><p className="text-[12px] font-bold">{p.brand}</p><p className="muted mt-1 break-all text-[10px]">{p.originalUrl}</p></div><p className="muted text-[10px]">판매처의 가격·배송·교환 조건은 STOCKDROP과 다를 수 있어요.</p><div className="flex gap-2"><Button outline className="flex-1" onClick={() => setExtPopup(false)}>취소</Button><Button className="flex-1" onClick={() => { window.open(externalHref(p.originalUrl, p.id), '_blank', 'noopener,noreferrer'); setExtPopup(false); }}>이동하기</Button></div></div></Modal>}
  </div>;
}

function OptionSheet({ product: p, onClose }: { product: Product; onClose: () => void }) {
  const s = useStore(), now = useClock(), navigate = useNavigate(); const [quantities, setQuantities] = useState<Record<string, number>>({}); const [error, setError] = useState(''), [busy, setBusy] = useState(false), [existing, setExisting] = useState(''), [failedOptionId, setFailedOptionId] = useState<string | null>(null);
  const count = Object.values(quantities).reduce((a, b) => a + b, 0);
  async function buy() { setError(''); setExisting(''); setFailedOptionId(null); setBusy(true); try { const hold = await atomic(state => reserve(state, state.activeUserId, p.id, quantities, nowOf(state))); onClose(); navigate(`/checkout/${hold.id}`); } catch (e) { const err = e as DomainError; setError(err.message); if (err.code?.startsWith('existing:')) setExisting(err.code.slice(9)); if (err.code === 'stock') { const name = err.message.split(' 재고가')[0]; setFailedOptionId(p.options.find(o => o.name === name)?.id ?? null); } } finally { setBusy(false); } }
  const hasFailure = !!failedOptionId;
  return <Modal title="옵션 선택" onClose={onClose}><div className="space-y-4">{hasFailure && <div className="rounded-[4px] bg-[var(--red-soft)] p-3"><p className="text-[13px] font-bold text-[var(--red)]">재고를 확보하지 못했어요</p><p className="text-[12px] text-[var(--red)] leading-relaxed mt-1">크림 / S의 남은 수량이 부족해요. 수량을 다시 선택해 주세요. 결제는 진행되지 않았어요.</p></div>}<ProductSummary product={{ ...p, image: p.images[0] }}/><Note title="선착순 진행 중">마감까지 {countdown(p.endsAt, now)} · 계정당 최대 {p.maxPerAccount}개까지 구매할 수 있어요.</Note><div><p className="label mb-2">옵션 <span className="muted text-[10px]">· 필수</span></p><p className="muted mb-3 text-[11px]">색상 / 사이즈를 선택해 주세요</p>{p.options.map(o => { const avail = available(s, p, o.id, now); const failed = failedOptionId === o.id; return <div key={o.id} className={`space-y-2 py-3 divider${failed ? ' rounded-[4px] border border-[var(--red)] px-3' : ''}`}><div className="flex items-center justify-between gap-2"><span className="text-[13px] font-medium">{o.name}</span>{failed ? <span className="rounded-full bg-[var(--red-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--red)]">품절</span> : <span className="muted text-[10px]">남은 {avail}개</span>}</div><div className="flex items-center justify-end gap-2"><button aria-label={`${o.name} 수량 감소`} className="grid h-9 w-9 place-items-center rounded border border-[var(--line)]" disabled={!quantities[o.id]} onClick={() => setQuantities({ ...quantities, [o.id]: Math.max(0, (quantities[o.id] ?? 0) - 1) })}><Minus size={15}/></button><output aria-label={`${o.name} 선택 수량`} className="w-7 text-center">{quantities[o.id] ?? 0}</output><button aria-label={`${o.name} 수량 추가`} className="grid h-9 w-9 place-items-center rounded border border-[var(--line)]" disabled={failed || count >= p.maxPerAccount || (quantities[o.id] ?? 0) >= avail} onClick={() => setQuantities({ ...quantities, [o.id]: (quantities[o.id] ?? 0) + 1 })}><Plus size={15}/></button></div>{failed && <p className="text-[11px] text-[var(--red)]">남은 {avail}개 · 선택 수량을 줄여 주세요</p>}</div>; })}</div><ErrorBox message={error}/>{existing && <Link to={`/checkout/${existing}`} className="btn w-full" onClick={onClose}>진행 중인 주문으로 이동</Link>}{hasFailure && <div className="flex gap-2"><Button outline className="flex-1" onClick={() => setFailedOptionId(null)}>옵션 다시 선택</Button><Button className="flex-1" disabled={!count || busy} onClick={buy}>남은 옵션으로 구매하기</Button></div>}<InfoRow label={`상품금액 (${count}개)`} value={money(p.price * count)} strong/><InfoRow label="고정 배송비" value={money(p.shipping)}/><InfoRow label="합계" value={money(p.price * count + p.shipping)} strong/><p className="muted text-[10px] leading-relaxed">옵션 선택은 재고 확보가 아닙니다. 구매하기로 확보에 성공하면 5분 안에 결제를 완료해 주세요.</p>{!hasFailure && <Button className="w-full" disabled={!count || busy || saleState(p, now) !== '판매 중'} onClick={buy}>{busy ? '재고를 확인하고 있어요…' : '구매하기'}</Button>}</div></Modal>;
}

export function CheckoutPage() {
  const { id } = useParams(); const s = useStore(), now = useClock(), navigate = useNavigate(), toast = useToast(); const user = activeUser(s); const hold = s.holds.find(h => h.id === id && h.userId === user.id); const p = s.products.find(p => p.id === hold?.productId); const [terms, setTerms] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState(''), [selecting, setSelecting] = useState(false);
  const [savedAddrs, setSavedAddrs] = useState<SavedAddress[]>([]); const here = `/checkout/${id}`; const editHref = () => { const cur = savedAddrs.find(a => a.roadAddress === address.address && a.recipientName === address.name); return cur ? `/addresses/${cur.addressId}/edit?returnTo=${encodeURIComponent(here)}` : `/addresses/new?returnTo=${encodeURIComponent(here)}`; };
  const [address, setAddress] = useState<Address>(() => s.addresses[user.id] ?? { name: user.name, phone: user.phone, address: '', detail: '', request: '' });
  useEffect(() => { if (hold?.orderId) navigate(`/orders/${hold.orderId}?complete=1`, { replace: true }); }, [hold?.orderId, navigate]);
  useEffect(() => { listAddresses().then(data => { if (!data.length) return; setSavedAddrs(data); const current = s.addresses[user.id]; const picked = data.find(a => current && a.roadAddress === current.address && a.recipientName === current.name) ?? data.find(a => a.defaultAddress) ?? data[0]; setAddress(toAddress(picked)); }).catch(() => {}); }, []);
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
      else if (latest.paymentOutcome === 'failure') setError('결제가 완료되지 않았어요');
      else toast('결제 결과를 확인하고 있어요. 확인 전에는 재고를 반환하지 않습니다.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  const headerSubtitle = hold.status === 'pending' ? '결제 결과를 확인하고 있어요' : expired ? '결제 시간이 만료되어 확보한 재고가 해제됐어요' : '재고 확보 성공 · 5분 안에 결제를 완료하세요';
  return <div className="space-y-5"><Header title="주문 / 결제" subtitle={headerSubtitle}/>{hold.status === 'pending' ? <div className="rounded-[6px] bg-[var(--ink)] p-4 text-[var(--surface)]"><p className="mb-2 text-[11px] opacity-70">결제 결과를 확인하고 있어요</p><p className="font-number text-[32px] font-bold">확인 중</p><p className="mt-2 text-[10px] opacity-70">잠시만 기다려 주세요. 확인 중에는 결제를 다시 요청하지 않아요.</p></div> : expired ? <div className="rounded-[6px] bg-[var(--ink)] p-4 text-[var(--surface)]"><p className="mb-2 text-[11px] opacity-70">선착순 재고 확보 시간 종료</p><p className="font-number text-[32px] font-bold opacity-40">00:00</p><p className="mt-2 text-[10px] opacity-70">5분 안에 결제되지 않아 재고가 다음 구매자에게 넘어갔어요.</p></div> : <div className="rounded-[6px] bg-[var(--ink)] p-4 text-[var(--surface)]"><p className="mb-2 text-[11px] opacity-70">선착순 재고 확보 성공</p><p className="font-number text-[32px] font-bold">{countdown(hold.expiresAt, now)}</p><p className="mt-2 text-[10px] opacity-70">새로고침·재시도로 확보 시간이 연장되지 않습니다.</p></div>}<ProductSummary product={{ ...p, image: p.images[0] }} option={hold.lines.map(l => `${l.name} / ${l.quantity}개`).join('\n')} amount={hold.lines.reduce((n, l) => n + l.quantity * p.price, 0)}/><section className="divider space-y-3 pb-5"><div className="flex items-center justify-between"><h2 className="text-[15px] font-bold">배송지</h2><div className="flex gap-3">{savedAddrs.length > 1 && <button className="text-[11px] underline" onClick={() => setSelecting(true)}>변경</button>}<button className="text-[11px] underline" onClick={() => navigate(editHref())}>수정</button></div></div>{address.address ? <><p className="text-[12px]">{address.name} · {address.phone}</p><p className="muted text-[12px] leading-relaxed">{address.address}{address.detail ? ` ${address.detail}` : ''}{(address as any).request ? <><br/>{(address as any).request}</> : null}</p></> : <button className="text-[12px] text-[var(--red)] underline" onClick={() => navigate(editHref())}>배송지를 입력해 주세요</button>}</section><div className="space-y-2"><InfoRow label="상품금액" value={money(hold.lines.reduce((n, l) => n + l.quantity * p.price, 0))}/><InfoRow label="고정 배송비" value={money(p.shipping)}/><InfoRow label="최종 결제금액" value={money(hold.lines.reduce((n, l) => n + l.quantity * p.price, 0) + p.shipping)} strong/></div>{error === '결제가 완료되지 않았어요' ? <div className="space-y-4"><h2 className="text-[22px] font-bold">결제가 완료되지 않았어요</h2><p className="muted text-[13px] leading-relaxed">결제가 승인되지 않아 금액이 빠져나가지 않아요.</p><section className="space-y-2 rounded-[4px] bg-[var(--soft)] p-4"><h3 className="text-[13px] font-bold mb-2">결제 정보</h3><InfoRow label="사유" value="사용자가 결제를 취소함"/><InfoRow label="주문번호" value={hold.id}/><InfoRow label="최종 결제금액" value={money(hold.lines.reduce((n, l) => n + l.quantity * p.price, 0) + p.shipping)}/></section><section className="space-y-2 rounded-[4px] bg-[var(--soft)] p-4"><h3 className="text-[13px] font-bold mb-2">현재 확보 상태</h3><div className="flex items-center justify-between"><span className="muted text-[12px]">재고 확보 중</span><span className="text-[12px] font-semibold text-[var(--green)]">{countdown(hold.expiresAt, now)} 안에 결제</span></div><p className="muted text-[11px] mt-1">남은 시간 안에 다시 결제하면 같은 수량으로 구매할 수 있어요. 새로고침·재시도로 확보 시간이 연장되지 않습니다.</p></section><div className="flex gap-2"><Link className="btn btn-outline flex-1" to={`/product/${p.id}`}>상품으로 돌아가기</Link><Link className="btn flex-1" to="/orders">주문 상태</Link></div></div> : <><Note title="안전한 결제">선택한 상품과 최종 결제금액을 확인해 주세요. 결제 승인 후 주문이 확정됩니다.</Note><label className="flex items-start gap-3 text-[12px] leading-relaxed"><input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} className="mt-1 h-4 w-4"/>주문 내용과 판매조건을 확인했으며 결제에 동의합니다.</label>{error && error !== '결제가 완료되지 않았어요' && <ErrorBox message={error}/>}{expired ? <><h2 className="text-[22px] font-bold">결제 시간이 지나<br/>주문이 취소됐어요</h2><p className="muted text-[13px] leading-relaxed">결제는 진행되지 않았어요. 남은 수량이 있으면<br/>다시 구매를 시작해 결제 시간을 확보할 수 있어요.</p><ProductSummary product={{ ...p, image: p.images[0] }} option={hold.lines.map(l => `${l.name} / ${l.quantity}개`).join('\n')} amount={hold.lines.reduce((n, l) => n + l.quantity * p.price, 0)}/><p className="muted text-[12px] leading-relaxed">결제가 승인되지 않아 금액이 빠져나가지 않아요.<br/>입력한 배송지는 다음 주문에 그대로 쓸 수 있어요.</p><div className="flex gap-2"><Link className="btn btn-outline flex-1" to="/">홈으로</Link><Link className="btn flex-1" to={`/product/${p.id}`}>다시 구매하기</Link></div></> : <Button className="w-full" disabled={busy || (!terms && hold.status !== 'pending')} onClick={pay}>{busy ? '결제 결과 확인 중…' : hold.status === 'pending' ? '결제 결과 다시 확인' : `${countdown(hold.expiresAt, now)} 안에 결제하기`}</Button>}</>}
    {selecting && (() => { const [selAddr, setSelAddr] = useState(address); return <BottomSheet title="배송지 선택" onClose={() => setSelecting(false)}><div className="space-y-0"><p className="mb-2 text-[11px] text-[var(--red)]">{countdown(hold.expiresAt, now)} 안에 결제를 완료하세요</p>{savedAddrs.map((a: any) => { const sel = selAddr.address === a.roadAddress && selAddr.name === a.recipientName; return <button key={a.addressId} onClick={() => setSelAddr({ name: a.recipientName, phone: a.recipientPhone, address: a.roadAddress, detail: a.detailAddress, request: a.deliveryMemo, postalCode: a.postalCode } as any)} className="divider flex w-full items-start gap-3 py-4 text-left"><span className={`mt-0.5 h-4 w-4 shrink-0 rounded-full border-2 ${sel ? 'border-[var(--ink)] bg-[var(--ink)]' : 'border-[var(--line)]'}`}/><div><div className="flex items-center gap-2"><p className="text-[12px] font-semibold">{a.label ?? '배송지'}</p>{a.defaultAddress && <span className="rounded-full bg-[var(--blue-soft)] px-2 py-0.5 text-[10px] font-semibold">기본</span>}</div><p className="mt-1 text-[12px]">{a.recipientName} · {a.recipientPhone}</p><p className="muted text-[11px]">{a.roadAddress}{a.detailAddress ? ` ${a.detailAddress}` : ''}</p></div></button>; })}<button className="mt-2 flex w-full items-center justify-center gap-2 rounded-[4px] border border-[var(--line)] py-3 text-[12px]" onClick={() => { setSelecting(false); navigate(`/addresses/new?returnTo=${encodeURIComponent(here)}`); }}><Plus size={15}/>새 배송지 추가</button><p className="mt-3 text-center text-[11px] text-[var(--red)]">결제 시간은 계속 흘러가요 · {countdown(hold.expiresAt, now)} 남음</p><Button className="mt-3 w-full" onClick={() => { setAddress(selAddr); setSelecting(false); }}>이 주소로 배송</Button></div></BottomSheet>; })()}
  </div>;
}
export function OrdersPage() {
  const s = useStore(), now = useClock(); const [tab, setTab] = useState('전체'); const orders = s.orders.filter(o => o.userId === s.activeUserId); const activeHolds = s.holds.filter(h => h.userId === s.activeUserId && (h.status === 'pending' || h.status === 'reserved' && h.expiresAt > now)); const tabs = ['전체', '배송 준비', '배송 중', '배송 완료', '취소·환불'];
  const filtered = orders.filter(o => tab === '전체' || tab === '배송 준비' && ['paid', 'preparing'].includes(o.status) || ORDER_LABELS[o.status] === tab || tab === '취소·환불' && ['cancelled', 'refunded'].includes(o.status));
  return <><Header title="주문 · 배송" subtitle="주문 상세와 배송 조회를 구분해서 확인하세요." back={false}/>{activeHolds.map(h => <Link key={h.id} to={`/checkout/${h.id}`} className="mb-4 block rounded-[4px] bg-[var(--blue-soft)] p-4"><b className="text-[12px]">{h.status === 'pending' ? '결제 결과 확인 중' : '확보한 주문 이어서 결제'}</b><p className="muted mt-2 text-[11px]">{s.products.find(p => p.id === h.productId)?.name} · {h.status === 'pending' ? '결제 완료 여부를 확인해 주세요.' : `${countdown(h.expiresAt, now)} 남음`} ›</p></Link>)}<div className="divider flex justify-between gap-1 pb-2">{tabs.map(t => <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-2 text-[10px] ${tab === t ? 'border-[var(--ink)] font-bold' : 'muted border-transparent'}`}>{t}</button>)}</div>{filtered.map(o => <article key={o.id} className="divider space-y-4 py-5"><div className="flex items-center justify-between"><span className="muted max-w-[235px] truncate text-[10px]">{o.id}</span><Badge live={['shipping', 'delivered'].includes(o.status)}>{ORDER_LABELS[o.status]}</Badge></div><ProductSummary product={o.product} option={o.lines.map(l => `${l.name} ${l.quantity}개`).join(' · ')} amount={o.total}/><div className="grid grid-cols-2 gap-2"><Link className="btn" to={`/orders/${o.id}${['shipping', 'delivered'].includes(o.status) ? '?tracking=1' : ''}`}>{['shipping', 'delivered'].includes(o.status) ? '배송 조회' : '주문 상세'}</Link><Link className="btn btn-outline" to={`/orders/${o.id}`}>{['shipping', 'delivered'].includes(o.status) ? '주문 상세' : '판매자 문의'}</Link></div></article>)}{!filtered.length && <Empty title="주문 내역이 없어요"><Link className="btn" to="/">상품 둘러보기</Link></Empty>}</>;
}

export function OrderDetailPage() {
  const { id } = useParams(); const [params, setParams] = useSearchParams(); const s = useStore(), user = activeUser(s); const o = s.orders.find(o => o.id === id && o.userId === user.id); const [contact, setContact] = useState(false); const complete = params.has('complete'), tracking = params.has('tracking');
  if (!o) return <Empty title="주문을 찾을 수 없어요"><Link to="/orders" className="btn">주문 목록</Link></Empty>;
  const events: [number, string, string][] = [...(o.processedAt ? [[o.processedAt, '배송 완료', o.deliveredPlace ?? '수령 완료'] as [number, string, string]] : []), ...(o.shippedAt ? [[o.shippedAt, '배송 출발', o.carrier ?? ''] as [number, string, string]] : []), [o.createdAt, '상품 발송', '판매자가 상품을 택배사에 전달했어요'], [o.createdAt, '결제 완료', '주문이 확정되었어요']];
  const deliveredDate = o.deliveredAt ? new Date(o.deliveredAt) : null;
  const deliveredStr = deliveredDate ? `${deliveredDate.getMonth() + 1}월 ${deliveredDate.getDate()}일(${['일','월','화','수','목','금','토'][deliveredDate.getDay()]}) ${deliveredDate.getHours().toString().padStart(2,'0')}:${deliveredDate.getMinutes().toString().padStart(2,'0')} 도착` : '';
  const dispatchDaysStr = (() => { const d = new Date(o.createdAt); d.setDate(d.getDate() + 3); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${['일','월','화','수','목','금','토'][d.getDay()]}) 도착 예정`; })();
  return <div className="space-y-5"><Header title={complete ? '결제 완료' : '주문 · 배송 상세'} subtitle={complete ? '배송이 곧 시작돼요' : `주문번호 ${o.id}`}/>{complete ? <div className="space-y-4"><CheckCircle2 size={38} className="text-[var(--green)]"/><h1 className="text-[25px] font-bold">축하해요!</h1><p className="text-[14px]">선착순 구매에 성공했어요</p><p className="muted text-[11px]">{dispatchDaysStr}</p><p className="muted text-[11px]">배송이 시작되면 알려드릴게요</p><p className="text-[13px] font-bold">배송 현황</p><DeliveryProgress status={o.status}/><section className="space-y-2 rounded-[4px] bg-[var(--blue-soft)] p-4"><h3 className="mb-2 text-[13px] font-bold">주문 정보</h3><InfoRow label="주문번호" value={o.id}/><InfoRow label="결제 금액" value={money(o.total - o.shipping)}/><InfoRow label="결제 수단" value="신용카드 (현대 1234)"/></section><section className="space-y-2 rounded-[4px] bg-[var(--blue-soft)] p-4"><h3 className="mb-2 text-[13px] font-bold">배송지</h3><p className="text-[12px]">{o.address.name ? `${o.address.name} · ${o.address.address}` : '배송지 정보 없음'}</p></section></div> : <><h2 className="text-[24px] font-bold tracking-[-.7px]">{o.status === 'delivered' ? '배송이 완료됐어요' : o.status === 'shipping' ? '상품이 배송 중이에요' : ['cancelled', 'refunded'].includes(o.status) ? ORDER_LABELS[o.status] : o.status === 'preparing' ? '상품을 준비하고 있어요' : '결제가 완료되었어요'}</h2>{deliveredStr && <p className="muted text-[13px]">{deliveredStr}</p>}<DeliveryProgress status={o.status}/></>}
    <ProductSummary product={o.product} option={o.lines.map(l => `${l.name} / ${l.quantity}개`).join('\n')} amount={o.lines.reduce((n, l) => n + l.quantity * o.product.price, 0)}/>
    {o.status === 'delivered' ? <Note green title={deliveredStr || '배송 완료'}><p className="mb-1">{o.deliveredPlace ?? '문 앞에 안전하게 배송했어요'}</p>{o.tracking && <p className="mt-1">{o.carrier} · 송장 {o.tracking}</p>}{o.processedAt && <p className="muted mt-1 text-[11px]">10월 28일에 자동으로 구매 확정돼요</p>}</Note> : o.status === 'shipping' ? <Note title="상품이 이동중이에요">운송장을 조회하여 배송 현황을 확인할 수 있습니다.<br/>{o.carrier} · {o.tracking}</Note> : <Note title="판매자가 상품을 준비하고 있어요">운송장이 등록되면 배송 정보를 확인할 수 있습니다.</Note>}
    <section className="space-y-2"><h3 className="mb-3 text-[15px] font-bold">주문 및 결제 정보</h3>{o.tracking && <><InfoRow label="택배사" value={o.carrier}/><InfoRow label="운송장 번호" value={<span className="inline-flex items-center gap-1">{o.tracking}<CopyButton value={o.tracking}/></span>}/></>}<InfoRow label="상품금액" value={money(o.total - o.shipping)}/><InfoRow label="고정 배송비" value={money(o.shipping)}/><InfoRow label="최종 결제금액" value={money(o.total)} strong/><InfoRow label="결제 방법" value="카드 결제"/></section>
    <section className="divider space-y-3 py-4"><h3 className="text-[15px] font-bold">배송지</h3><p className="text-[12px]">{o.address.name} · {o.address.phone}</p><p className="muted text-[12px] leading-relaxed">{o.address.address}{o.address.detail ? ` ${o.address.detail}` : ''}</p>{o.address.request && <p className="muted text-[12px]">요청사항 · {o.address.request}</p>}</section>
    {!complete && <section><h3 className="mb-3 text-[15px] font-bold">주문 진행 내역</h3>{events.map(([time, title, desc], i) => <div key={i} className="divider flex gap-3 py-3"><PackageCheck size={17} className={i ? 'muted' : 'text-[var(--green)]'}/><div className="min-w-0 flex-1"><div className="flex justify-between gap-2"><b className="text-[12px]">{title}</b><span className="muted text-[10px]">{dateTime(time)}</span></div><p className="muted mt-1 text-[11px]">{desc}</p></div></div>)}</section>}
    {o.status === 'delivered' && !complete ? <section className="space-y-3 rounded-[4px] bg-[var(--blue-soft)] p-4"><h3 className="text-[13px] font-bold">상품에 문제가 있나요?</h3><p className="muted text-[12px]">구매 확정 전까지 반품·교환을 신청할 수 있어요.</p><p className="muted text-[12px]">단순 변심 반품은 왕복 배송비 3000원이 부과돼요.</p><div className="flex gap-2"><Button outline className="flex-1" onClick={() => setContact(true)}>반품·교환</Button><Button className="flex-1" onClick={() => setContact(true)}>구매 확정</Button></div></section> : <><Note title="상품을 확인해 주세요">취소·반품·하자·오배송은 판매자에게 문의해 주세요. 교환은 지원하지 않습니다.</Note><Button outline className="w-full" onClick={() => setContact(true)}>판매자 문의 · 반품 문의</Button></>}{complete ? <><Link className="btn w-full" to="/">쇼핑 계속하기</Link><Button outline className="w-full" onClick={() => setParams({})}>상세 배송조회</Button></> : <Link className="btn w-full" to="/orders">주문 목록으로</Link>}{contact && <OrderContactModal order={o} onClose={() => setContact(false)}/>}
  </div>;
}
function OrderContactModal({ order, onClose }: { order: Order; onClose: () => void }) {
  const toast = useToast(); const [kind, setKind] = useState('하자·파손'), [question, setQuestion] = useState(''), [error, setError] = useState('');
  const kinds = ['하자·파손', '배송 지연', '오배송', '반품', '교환', '기타'];
  return <Modal title="판매자에게 문의" onClose={onClose}><form className="space-y-4" onSubmit={e => { e.preventDefault(); if (!question.trim()) { setError('문의 내용을 입력해 주세요.'); return; } try { mutate(s => { s.inquiries.unshift({ id: uid('q-'), userId: s.activeUserId, sellerId: order.sellerId, productId: order.productId, orderId: order.id, productName: `${order.product.brand} · ${order.product.name}`, kind, question: question.trim(), public: false, createdAt: nowOf(s) }); }); toast('문의가 판매자에게 전달되었습니다.'); onClose(); } catch (e) { setError((e as Error).message); } }}>
    {/* 상품 요약 — Figma: 브랜드 · 상품명 · 수량, 주문번호 */}
    <div className="rounded-[6px] bg-[var(--soft)] p-3 space-y-0.5">
      <p className="text-[13px] font-semibold">{order.product.brand}</p>
      <p className="text-[13px]">{order.product.name} · {order.lines.reduce((n,l)=>n+l.quantity,0)}개</p>
      <p className="muted text-[11px]">주문번호 {order.id}</p>
    </div>
    <div className="space-y-2">
      <p className="label">문의 유형 <span className="muted text-[10px]">· 필수</span></p>
      <div className="flex flex-wrap gap-2">{kinds.map(k => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}</div>
    </div>
    <Field label="문의 내용"><textarea aria-label="문의 내용" className="field field-box" value={question} onChange={e => setQuestion(e.target.value)} maxLength={1000} placeholder="문의 내용을 입력해 주세요" required/><p className="muted mt-1 text-right text-[10px]">{question.length} / 1000</p></Field>
    <p className="muted text-[11px]">사진 첨부 <span className="text-[10px]">· 선택 · 최대 5장</span></p>
    <p className="muted text-[10px] leading-relaxed">하자·오배송은 사진이 있으면 더 빠르게 처리돼요</p>
    <p className="muted text-[10px] leading-relaxed">판매자는 영업일 기준 1일 안에 답변해요.<br/>2영업일 안에 답변이 없으면 StockDrop이 직접 확인하고 연락드려요.</p>
    <ErrorBox message={error}/>
    <Button type="submit" className="w-full">문의 보내기</Button>
  </form></Modal>;
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
  const prevMonth = () => { setSelected(null); setViewDate(new Date(year, month - 1, 1)); };
  const nextMonth = () => { setSelected(null); setViewDate(new Date(year, month + 1, 1)); };
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
      {selected && (() => {
        const dayNames = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];
        const selDate = new Date(year, month, selected);
        const firstOpen = selectedSales.length ? new Date(Math.min(...selectedSales.map(p => p.startsAt))).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false }) : null;
        return (
          <div className="space-y-2">
            <div className="flex items-center justify-between py-1">
              <h2 className="text-[14px] font-bold">{month + 1}월 {selected}일 {dayNames[selDate.getDay()]}</h2>
              {selectedSales.length > 0 && <span className="muted text-[11px]">판매 {selectedSales.length}개 · 첫 오픈 {firstOpen}</span>}
            </div>
            {selectedSales.length ? selectedSales.sort((a, b) => a.startsAt - b.startsAt).map(p => (
              <Link key={p.id} to={`/product/${p.id}`} className="divider flex items-center gap-3 py-3">
                <Calendar size={16} className="muted shrink-0"/>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="rounded bg-[var(--blue-soft)] px-1.5 py-0.5 text-[10px] font-semibold">오픈 예정</span>
                    <span className="muted text-[10px]">{new Date(p.startsAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 오픈</span>
                  </div>
                  <p className="text-[12px] font-semibold">{p.brand}</p>
                  <p className="muted text-[11px]">{p.name}</p>
                </div>
                <ChevronRight size={16} className="muted shrink-0"/>
              </Link>
            )) : <p className="muted text-[12px]">이 날에 예정된 판매가 없어요.</p>}
          </div>
        );
      })()}
      <p className="muted text-[10px]">판매 상품 확인하기 버튼을 눌러 상세 일정을 확인하세요.</p>
    </div>
  );
}

interface Notification { id: string; type: '구매' | '상품' | '맞춤 추천'; title: string; desc: string; time: string }

export function NotificationsPage() {
  const s = useStore(), now = useClock();
  const [tab, setTab] = useState<'전체' | '구매' | '상품'>('전체');
  const tabs = ['전체', '구매', '상품'] as const;

  const userOrders = s.orders.filter(o => o.userId === s.activeUserId);
  const bookmarkedIds = s.bookmarks.filter(k => k.startsWith(`${s.activeUserId}:`)).map(k => k.split(':')[1]);
  const bookmarkedProducts = s.products.filter(p => bookmarkedIds.includes(p.id) && p.published);

  const raw: Array<{ id: string; type: '구매' | '상품' | '맞춤 추천'; title: string; desc: string; ts: number }> = [
    ...userOrders.flatMap(o => {
      if (o.status === 'delivered' && o.deliveredAt)
        return [{ id: `o-${o.id}-d`, type: '구매' as const, title: '배송 완료', desc: `${o.product.name} 배송이 완료되었어요.`, ts: o.deliveredAt }];
      if (o.status === 'shipping' && o.shippedAt)
        return [{ id: `o-${o.id}-s`, type: '구매' as const, title: '배송 시작', desc: `${o.product.name}이 출고되었어요.`, ts: o.shippedAt }];
      return [{ id: `o-${o.id}-p`, type: '구매' as const, title: '구매 확정', desc: `${o.product.name} 주문이 확정되었습니다.`, ts: o.createdAt }];
    }),
    ...bookmarkedProducts.flatMap(p => {
      const state = saleState(p, now);
      const avail = p.options.reduce((n, o) => n + available(s, p, o.id, now), 0);
      const total = p.options.reduce((n, o) => n + o.stock, 0);
      const items: typeof raw = [];
      if (state === '판매 중') {
        items.push({ id: `b-${p.id}-on`, type: '상품', title: '판매 시작', desc: `찜한 상품 '${p.name}'의 판매가 막 시작됐어요.`, ts: p.startsAt });
        if (avail > 0 && avail <= Math.ceil(total * 0.3))
          items.push({ id: `b-${p.id}-low`, type: '상품', title: '재고 임박', desc: `관심 상품의 재고가 얼마 남지 않았어요. 지금 확인해보세요.`, ts: p.startsAt + 60_000 });
      }
      if (state === '판매 예정')
        items.push({ id: `b-${p.id}-up`, type: '맞춤 추천', title: '맞춤 추천', desc: `회원님이 좋아할 것 같은 ${p.name}이 판매 중이에요.`, ts: p.startsAt - 3_600_000 });
      return items;
    }),
  ].sort((a, b) => b.ts - a.ts);

  const notifications: Notification[] = raw.map(n => ({ ...n, time: dateTime(n.ts) }));
  const filtered = tab === '전체' ? notifications : notifications.filter(n => n.type === tab || (tab === '상품' && n.type === '맞춤 추천'));

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
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${n.type === '맞춤 추천' ? 'bg-[var(--green-soft,#EEF8F3)] text-[var(--green)]' : 'bg-[var(--blue-soft)]'}`}>{n.type}</span>
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
