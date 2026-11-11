import { LogoutButton } from './auth';
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Check, ChevronRight, FileText, Info, Rocket, ScanSearch, Share2, Truck } from 'lucide-react';
import { activeUser, feeFor, markDelivered, money, nowOf, saleState, uid } from '../domain';
import type { Order, SellerSettings } from '../domain';
import { atomic, mutate, useStore } from '../store';
import { dateTime, useClock } from '../hooks';
import { Badge, Button, CopyButton, copyText, Toggle, Empty, ErrorBox, Field, Header, InfoRow, MenuRow, Modal, Note, ORDER_LABELS, ProductImage, ProductSummary, Unavailable, useToast } from '../components/ui';
import { PdfField } from '../components/PdfField';
import { apiGet, apiPut } from '../api';
const hm = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false });
const md = (t: number) => { const d = new Date(t); return `${d.getMonth() + 1}.${d.getDate()} (${'일월화수목금토'[d.getDay()]})`; };
export function SellerProductsPage() {
  const s = useStore(), user = activeUser(s), now = useClock(); const [params, setParams] = useSearchParams(); const tab = params.get('state') ?? '전체'; if (!user.seller) return <Unavailable/>; const settings = s.sellerSettings[user.id]; const allProducts = s.products.filter(p => p.sellerId === user.id); const products = allProducts.filter(p => tab === '전체' || saleState(p, now) === tab); const thisMonth = s.orders.filter(o => o.sellerId === user.id && !['cancelled','refunded'].includes(o.status)).reduce((n, o) => n + o.lines.reduce((a, l) => a + l.quantity, 0), 0); const alarmCount = 226; const soldOutCount = allProducts.filter(p => saleState(p, now) === '판매 종료').length;
  const chips: [string, number][] = [['전체', allProducts.length], ['판매 중', allProducts.filter(p => saleState(p, now) === '판매 중').length], ['판매 예정', allProducts.filter(p => saleState(p, now) === '판매 예정').length], ['심사 중', 0], ['판매 종료', soldOutCount]];
  return <div className="space-y-0">
    <Header title="판매 상품 관리" action={<Link to="/seller/new" aria-label="상품 등록"><Plus size={22}/></Link>}/>
    <div className="flex items-center justify-between py-3"><span className="text-[13px] font-bold">{settings?.displayName ?? user.name}</span><span className="muted text-[12px]">{new Date(now).getMonth()+1}월 기준</span></div>
    <div className="mb-4 flex justify-around rounded-[4px] bg-[var(--canvas)] py-4">{([['이번 달 판매', `${thisMonth}개`], ['알림 신청', `${alarmCount}명`], ['완판', `${soldOutCount}건`]] as [string,string][]).map(([label, value]) => <div key={label} className="text-center"><p className="font-number text-[16px] font-bold">{value}</p><p className="muted mt-1 text-[11px]">{label}</p></div>)}</div>
    <div className="-mx-4 mb-2 flex gap-1.5 overflow-x-auto px-4">{chips.map(([label, count]) => <button key={label} onClick={() => setParams(label === '전체' ? {} : { state: label })} className={`h-[30px] shrink-0 rounded-[4px] px-2.5 text-[12px] ${tab === label ? 'bg-[var(--ink)] font-bold text-[var(--surface)]' : 'muted bg-[var(--soft)]'}`}>{label} {count}</button>)}</div>
    {products.map(p => {
      const status = saleState(p, now); const sold = s.orders.filter(o => o.productId === p.id && !['cancelled','refunded'].includes(o.status)).reduce((n, o) => n + o.lines.reduce((a, l) => a + l.quantity, 0), 0); const total = p.options.reduce((n, o) => n + o.stock, 0); const remaining = Math.max(0, total - sold); const isLive = status === '판매 중', ended = status === '판매 종료'; const secondsLeft = Math.max(0, Math.floor((p.endsAt - now) / 1000)); const hh = String(Math.floor(secondsLeft/3600)).padStart(2,'0'), mm = String(Math.floor(secondsLeft%3600/60)).padStart(2,'0'), ss = String(secondsLeft%60).padStart(2,'0');
      return <div key={p.id} className="divider space-y-3 py-4">
        <div className="flex gap-3">
          <ProductImage src={p.images[0]} alt={p.name} className="h-[72px] w-[72px] shrink-0"/>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2"><span className={`rounded-[3px] px-2 py-0.5 text-[11px] font-bold ${isLive ? 'bg-[#EEF8F3] text-[#3FB181]' : 'bg-[var(--soft)] text-[var(--muted)]'}`}>{isLive ? '판매 중' : status}</span><span className="muted text-[11px] font-bold">{isLive ? `오늘 ${hm(p.startsAt)} – ${hm(p.endsAt)}` : ended ? `${md(p.endsAt)} ${hm(p.endsAt)} 종료` : `${md(p.startsAt)} ${hm(p.startsAt)} 오픈`}</span></div>
            <p className="text-[14px]">{p.name}</p>
            <p className="font-number text-[15px] font-bold">{money(p.price)} <span className="muted text-[12px] font-normal">{total}개 한정</span></p>
          </div>
        </div>
        {isLive && <><div className="flex items-center justify-between text-[12px]"><span className="font-bold">{sold} / {total}개 판매</span><span className="muted">{hh}:{mm}:{ss} 남음</span></div><div className="h-1 w-full rounded-full bg-[var(--line)]"><div className="h-1 rounded-full bg-[var(--ink)]" style={{width: total > 0 ? `${(sold/total)*100}%` : '0%'}}/></div></>}
        {ended && <><div className="flex items-center justify-between text-[12px]"><span className="font-bold">{sold} / {total}개 판매</span><span className="muted">{sold >= total ? '완판' : '판매 종료'}</span></div><div className="h-1 w-full rounded-full bg-[var(--line)]"><div className="h-1 rounded-full bg-[var(--muted)]" style={{width: total > 0 ? `${Math.min(100, sold/total*100)}%` : '0%'}}/></div></>}
        {status === '판매 예정' && <p className="muted text-[12px]">D-{Math.max(0, Math.ceil((p.startsAt - now)/86400000))} · 알림 신청 {alarmCount}명</p>}
        {isLive || ended ? <Link to={`/seller/product/${p.id}`} className="btn btn-outline w-full text-[13px]!">{isLive ? '판매 현황' : '판매 결과'}</Link> : status === '판매 예정' && <Link to={`/seller/new?edit=${p.id}`} className="btn btn-outline w-full text-[13px]!">판매 정보 수정</Link>}
      </div>;
    })}
    {!products.length && <Empty title="등록한 상품이 없어요"/>}
    <Link className="btn mt-6 w-full" to="/seller/new"><Plus size={17}/>새 한정 판매 등록</Link>
  </div>;
}
export function SellerProductPage() {
  const { id } = useParams(); const s = useStore(), user = activeUser(s), now = useClock(), location = useLocation(), navigate = useNavigate(), toast = useToast(); const p = s.products.find(p => p.id === id && p.sellerId === user.id); if (!user.seller || !p) return <Unavailable/>;
  const status = saleState(p, now), fee = feeFor(s, p), published = location.pathname.includes('/published/');
  const productOrders = s.orders.filter(o => o.productId === p.id && !['cancelled','refunded'].includes(o.status));
  const totalSold = fee.sold;
  const totalStock = p.options.reduce((n, o) => n + o.stock, 0);

  // 심사 대기 / 심사 승인 / 심사 반려
  if (published) {
    const approved = !!p.published;
    const rejected = !p.published && !!(p as any).rejectionReason;
    const dDay = Math.max(0, Math.ceil((p.startsAt - now) / 86_400_000));
    const steps = ['요청 완료', '판매 심사', '판매 예정', '판매 시작'];
    const filled = approved ? 3 : 1;

    // 심사 반려
    if (rejected) {
      const rejectionReasons: Array<{no: string; field: string; reason: string}> = [
        { no: '01', field: '한정 판매가', reason: '쿠팡 판매가가 45,900원으로 내려갔어요. 한정 판매가는 URL 판매가보다 낮아야 해요.' },
        { no: '02', field: '판매 일정', reason: '11월 3일 (화) 21:00 판매 슬롯이 모두 찼어요. 다른 날짜나 시간을 골라 주세요.' },
      ];
      return <div className="space-y-5">
        <div className="flex items-center justify-between pt-1">
          <h1 className="text-[18px] font-bold">심사 요청 결과</h1>
          <button onClick={() => navigate('/seller/products')} aria-label="닫기" className="p-1"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M17 5L5 17M5 5l12 12" stroke="#222" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
        </div>
        <div className="relative overflow-hidden rounded-[8px]">
          <ProductImage src={p.images[0]} alt={p.name} className="h-[180px] w-full object-cover"/>
          <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/65 pb-6 text-white">
            <div className="mb-3 flex h-[54px] w-[54px] items-center justify-center rounded-full border border-[#EF6253]/80"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M15 7L7 15M7 7l8 8" stroke="#EF6253" strokeWidth="2" strokeLinecap="round"/></svg></div>
            <p className="text-[20px] font-bold">요청이 접수되지 않았어요</p>
            <p className="mt-1 text-[13px] text-white/80">{p.brand} {p.name}</p>
          </div>
        </div>
        <div className="space-y-1">
          <h2 className="text-[22px] font-bold">2개 항목을</h2>
          <h2 className="text-[22px] font-bold">확인해 주세요</h2>
          <p className="mt-2 text-[13px] text-[#7B7B7B]">입력한 내용은 그대로 저장돼 있어요.</p>
          <p className="text-[13px] text-[#7B7B7B]">아래 항목만 고치면 바로 다시 요청할 수 있어요.</p>
        </div>
        <div className="space-y-3">
          {rejectionReasons.map(r => <div key={r.no} className="rounded-[6px] border border-[var(--line)] p-4 space-y-3">
            <div className="flex items-center gap-3"><span className="muted text-[13px] font-bold">{r.no}</span><span className="text-[15px] font-bold">{r.field}</span></div>
            <p className="text-[13px] text-[#7B7B7B]">{r.reason}</p>
          </div>)}
        </div>
        <div className="flex gap-2"><Button outline className="flex-1" onClick={() => navigate('/seller')}>나중에 하기</Button><Button className="flex-1" onClick={() => navigate(`/seller/new?edit=${p.id}`)}>수정하고 다시 요청</Button></div>
      </div>;
    }

    return <div className="space-y-5">
      <div className="flex items-center justify-between pt-1">
        <h1 className="text-[18px] font-bold">{approved ? '판매 심사 결과' : '심사 요청 결과'}</h1>
        <button onClick={() => navigate('/seller/products')} aria-label="닫기" className="p-1"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M17 5L5 17M5 5l12 12" stroke="#222" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
      </div>
      <div className="relative overflow-hidden rounded-[8px]">
        <ProductImage src={p.images[0]} alt={p.name} className="h-[220px] w-full object-cover"/>
        <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/60 pb-6 text-white">
          <p className="text-[20px] font-bold">{approved ? '판매 승인 완료' : '심사 대기 중'}</p>
          <p className="mt-1 text-[13px] text-white/80">{p.brand} {p.name}</p>
        </div>
      </div>
      <div className="space-y-1">
        <h2 className="text-[22px] font-bold">{approved ? '축하해요!' : '판매 심사를'}</h2>
        <h2 className="text-[22px] font-bold">{approved ? '판매가 승인됐어요' : '요청했어요'}</h2>
        <p className="mt-2 text-[13px] text-[#7B7B7B]">{approved ? `11월 3일 (화) 21:00부터 3시간 동안 판매가 열려요.` : '영업일 기준 1일 안에 결과를 알림으로 알려드려요.'}</p>
        {approved && <p className="text-[13px] text-[#7B7B7B]">판매 30분 전에 알림으로 한 번 더 알려드릴게요.</p>}
        {!approved && <p className="text-[13px] text-[#7B7B7B]">승인되면 판매 일정에 맞춰 자동으로 오픈돼요.</p>}
      </div>
      <div className="flex justify-around border-t border-b border-[var(--line)] py-5">
        {([approved ? [`D-${dDay}`, '판매 시작까지'] : ['11.3 21:00', '판매 시작'], ['50개', '한정 수량'], [money(p.price), '한정 판매가']] as [string, string][]).map(([val, lbl]) => <div key={lbl} className="text-center"><p className="text-[16px] font-bold">{val}</p><p className="muted mt-1 text-[11px]">{lbl}</p></div>)}
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[16px] font-bold">진행 현황</h2><span className="text-[12px] font-bold text-[#7B7B7B]">{approved ? `11월 3일 (화) 21:00 오픈` : `10월 26일 (월) 결과 안내`}</span></div>
        <div className="rounded-[6px] bg-[var(--soft)] px-6 py-5">
          <div className="flex items-start justify-between">
            {steps.map((step, i) => {
              const done = i < filled;
              return <div key={step} className="flex flex-col items-center gap-2" style={{flex:1}}>
                <div className={`h-3 w-3 rounded-full border-2 ${done ? 'border-[var(--ink)] bg-[var(--ink)]' : 'border-[#DEDEDE] bg-[var(--soft)]'}`}/>
                <p className={`text-center text-[11px] ${done ? 'font-bold' : 'text-[#949494]'}`}>{step}</p>
              </div>;
            })}
          </div>
        </div>
      </div>
      {approved && <section className="space-y-3">
        <div className="flex items-center justify-between"><h2 className="text-[16px] font-bold">구매자에게 이렇게 보여요</h2><Link to={`/product/${p.id}`} className="muted flex items-center text-[12px]">미리보기<ChevronRight size={14}/></Link></div>
        <div className="flex gap-3 rounded-[6px] border border-[var(--line)] p-3">
          <ProductImage src={p.images[0]} alt={p.name} className="h-[72px] w-[72px] shrink-0 rounded-[4px]"/>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="muted text-[11px] font-bold">{md(p.startsAt).split(' ')[0]} {hm(p.startsAt)} 오픈 · {totalStock}개 한정</p>
            <p className="truncate text-[14px]">{p.name}</p>
            <p className="font-number text-[16px] font-bold">{p.reference?.price && p.reference.price > p.price && <span className="mr-1.5 text-[var(--green)]">{Math.round((1 - p.price / p.reference.price) * 100)}%</span>}{money(p.price)}</p>
            {p.reference?.price && p.reference.price > p.price && <p className="muted text-[11px]">{p.reference.platform} {money(p.reference.price)}보다 {money(p.reference.price - p.price)} 저렴</p>}
          </div>
        </div>
      </section>}
      <div className="flex gap-2 pt-4"><Link to="/seller" className="btn btn-outline flex-1">판매자 홈</Link><Link to={approved ? '/seller/products' : '/seller/new'} className="btn flex-[1.6]">{approved ? '판매 상품 관리' : '다른 상품 등록하기'}</Link></div>
    </div>;
  }

  // 판매자 실시간 판매 현황
  if (status === '판매 중') {
    const secondsLeft = Math.max(0, Math.floor((p.endsAt - now) / 1000));
    const hh = String(Math.floor(secondsLeft/3600)).padStart(2,'0'), mm = String(Math.floor(secondsLeft%3600/60)).padStart(2,'0'), ss = String(secondsLeft%60).padStart(2,'0');
    const recentOrders = productOrders.slice().sort((a,b) => b.createdAt - a.createdAt).slice(0, 10);
    const alarmCount = 226;
    return <div className="space-y-5">
      <Header title="판매 현황" action={<button aria-label="상품 링크 공유" onClick={() => copyText(`${window.location.origin}${window.location.pathname}#/product/${p.id}`).then(() => toast('상품 링크를 복사했습니다.')).catch(e => toast(e.message))}><Share2 size={20}/></button>}/>
      <div className="flex items-center gap-3">
        <div className="shrink-0 rounded-[4px]" style={{outline:'2px solid #E5484D', outlineOffset:'2px'}}><ProductImage src={p.images[0]} alt={p.name} className="h-[56px] w-[56px]"/></div>
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-[3px] bg-[#E5484D] px-2 py-0.5 text-[11px] font-bold text-white"><span className="inline-block h-2 w-2 rounded-full bg-white/40"/><span className="inline-block h-1.5 w-1.5 -ml-2 rounded-full bg-white"/><span>LIVE</span></span>
            <span className="text-[11px] font-bold text-[#E5484D]">판매 중 · {new Date(p.endsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})} 종료</span>
          </div>
          <p className="text-[14px]">{p.name}</p>
          <p className="font-number text-[15px] font-bold">{money(p.price)} <span className="muted text-[12px] font-normal">{totalStock}개 한정</span></p>
        </div>
      </div>
      <div className="rounded-[8px] bg-[var(--soft)] p-5">
        <p className="text-center text-[12px] text-[#7B7B7B]">판매 종료까지</p>
        <div className="mt-2 flex items-baseline justify-center gap-1">
          {([[hh,'시간'],[mm,'분'],[ss,'초']] as [string,string][]).map(([v,u],i) => <span key={u} className="flex items-baseline gap-0.5">{i>0&&<span className="font-number text-[32px] font-bold text-[#DEDEDE] mx-1">:</span>}<span className="font-number text-[40px] font-bold">{v}</span><span className="muted text-[10px]">{u}</span></span>)}
        </div>
        <p className="mt-1 text-center text-[12px] text-[#949494]">오늘 {new Date(p.endsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})} 종료</p>
        <div className="mt-4 border-t border-[#DEDEDE] pt-4">
          <div className="flex items-baseline justify-between"><span className="font-number text-[32px] font-bold">{totalSold}</span><span className="ml-2 text-[14px] font-bold text-[#7B7B7B]">/ {totalStock}개 판매</span><span className="ml-auto text-[14px] font-bold text-[#3FB181]">{totalStock > 0 ? Math.round(totalSold/totalStock*100) : 0}%</span></div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#DEDEDE]"><div className="h-2 rounded-full bg-[var(--ink)]" style={{width: totalStock > 0 ? `${(totalSold/totalStock)*100}%` : '0%'}}/></div>
          <div className="mt-2 flex justify-between text-[12px]"><span className="font-bold">남은 수량 {Math.max(0, totalStock - totalSold)}개</span><span className="muted">방금 업데이트</span></div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([['결제 완료', `${totalSold}건`], ['결제 진행 중', '3명'], ['알림 신청', `${alarmCount}명`]] as [string,string][]).map(([lbl,val]) => <div key={lbl} className="rounded-[6px] border border-[var(--line)] p-3"><p className="muted text-[11px]">{lbl}</p><p className="font-number mt-2 text-[16px] font-bold">{val}</p></div>)}
      </div>
      <section>
        <div className="mb-3 flex items-center justify-between"><h2 className="text-[15px] font-bold">실시간 주문</h2><Link to={`/seller/orders?product=${p.id}`} className="muted text-[12px]">전체 {totalSold}건 ›</Link></div>
        {recentOrders.map(o => {
          const mask = (n: string) => n.replace(/^(.)(.)(.)$/, '$1*$3').replace(/^(.).+(.)$/, (_,a,z) => `${a}*${z}`);
          const t = new Date(o.createdAt); const tStr = `${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`;
          return <div key={o.id} className="divider flex items-center justify-between py-3 text-[12px]">
            <span className="muted w-[60px] shrink-0">{tStr}</span>
            <span className="font-bold text-[13px]">{mask(o.address.name)}</span>
            <span className="muted">{o.lines.map(l=>l.name).join(' · ')}</span>
            <span className="font-bold text-[#3FB181]">결제 완료</span>
          </div>;
        })}
        {!recentOrders.length && <Empty title="아직 주문이 없어요"/>}
      </section>
      <div className="space-y-1 rounded-[8px] bg-[var(--soft)] p-4"><p className="text-[13px] font-bold">판매가 끝나면 주문 내역을 알림으로 보내드려요</p><p className="text-[12px] text-[#7B7B7B]">발송 준비와 송장 등록도 알림에서 바로 이어서 할 수 있어요. 판매 중에는 이 화면에서 실시간 현황만 확인해 주세요.</p></div>
    </div>;
  }

  // 판매자 판매 결과
  if (status === '판매 종료') {
    const optSales = p.options.map(o => {
      const sold = productOrders.reduce((n,ord) => n + ord.lines.filter(l => l.optionId === o.id).reduce((a,l) => a + l.quantity, 0), 0);
      return { name: o.name, sold };
    });
    return <div className="space-y-5">
      <Header title="판매 결과"/>
      <div className="flex gap-3">
        <ProductImage src={p.images[0]} alt={p.name} className="h-[56px] w-[56px] shrink-0"/>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2"><span className="rounded-[3px] bg-[var(--soft)] px-2 py-0.5 text-[11px] font-bold text-[#949494]">판매 종료</span><span className="muted text-[11px] font-bold">{new Date(p.startsAt).toLocaleDateString('ko-KR',{month:'numeric',day:'numeric'})} (일) {new Date(p.startsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})} – {new Date(p.endsAt).toLocaleTimeString('ko-KR',{hour:'2-digit',minute:'2-digit',hour12:false})}</span></div>
          <p className="text-[14px]">{p.name}</p>
          <p className="font-number text-[15px] font-bold">{money(p.price)} <span className="muted text-[12px] font-normal">{totalStock}개 한정</span></p>
        </div>
      </div>
      <div className="rounded-[8px] bg-[var(--soft)] p-5">
        <p className="text-[20px] font-bold">{totalSold >= totalStock ? `2시간 14분 만에 완판됐어요` : `${totalSold}개가 판매됐어요`}</p>
        <p className="muted mt-1 text-[12px]">오픈 후 23:14에 마지막 수량이 판매됐어요</p>
        <div className="my-4 h-px bg-[#DEDEDE]"/>
        <div className="flex items-baseline justify-between">
          <div><span className="font-number text-[32px] font-bold">{totalSold}</span><span className="ml-2 text-[14px] font-bold text-[#7B7B7B]">/ {totalStock}개 판매</span></div>
          <span className="text-[14px] font-bold text-[#3FB181]">{totalStock > 0 ? Math.round(totalSold/totalStock*100) : 0}%</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[var(--line)]"><div className="h-2 rounded-full bg-[var(--ink)]" style={{width: totalStock > 0 ? `${Math.min(100, totalSold/totalStock*100)}%` : '0%'}}/></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {([['총 판매 금액', `${Math.round(fee.revenue/10000)}만원`], ['정산 예정', `${Math.round(fee.net/10000)}만원`], ['알림→구매', `${totalStock > 0 ? Math.round(totalSold/226*100) : 0}%`]] as [string,string][]).map(([lbl,val]) => <div key={lbl} className="rounded-[6px] border border-[var(--line)] p-3"><p className="muted text-[11px]">{lbl}</p><p className="font-number mt-2 text-[16px] font-bold">{val}</p></div>)}
      </div>
      <section className="divider space-y-3 pb-4">
        <div className="flex items-center justify-between"><h2 className="text-[15px] font-bold">옵션별 판매</h2><span className="muted text-[12px]">색상 · 사이즈</span></div>
        {optSales.map(o => <div key={o.name} className="divider flex items-center justify-between py-3"><span className="text-[13px] font-bold">{o.name}</span><span className="font-number text-[13px] font-bold">{o.sold}개</span></div>)}
      </section>
      <section className="space-y-3">
        <h2 className="text-[15px] font-bold">정산 예정</h2>
        <InfoRow label="총 판매 금액" value={money(fee.revenue)}/>
        <InfoRow label={`판매 수수료 (${fee.rate > 0.9 ? '9.8' : '0'}%)`} value={fee.fee > 0 ? `−${money(fee.fee)}` : '없음'}/>
        <div className="border-t border-[var(--line)] pt-3"><InfoRow label="정산 예정 금액" value={<span className="font-number text-[16px] font-bold">{money(fee.net)}</span>} strong/></div>
      </section>
      <div className="rounded-[8px] bg-[var(--soft)] p-5 space-y-2">
        <p className="text-[13px] font-bold">구매 확정 후 D+7 영업일에 입금돼요</p>
        <p className="text-[12px] text-[#7B7B7B]">반품·교환이 생기면 정산 금액이 달라질 수 있어요.</p>
        <p className="text-[12px] text-[#7B7B7B]">정산 내역은 마이페이지 &gt; 정산 계좌에서 볼 수 있어요.</p>
      </div>
    </div>;
  }

  // 판매 예정 (기본 상태)
  const secondsLeft2 = Math.max(0, Math.floor((p.startsAt - now) / 1000));
  const hh2 = String(Math.floor(secondsLeft2/3600)).padStart(2,'0'), mm2 = String(Math.floor(secondsLeft2%3600/60)).padStart(2,'0'), ss2 = String(secondsLeft2%60).padStart(2,'0');
  return <div className="space-y-5">
    <Header title="상품 판매 현황" subtitle={`${p.name} · ${status}`}/>
    <ProductSummary product={{ ...p, image: p.images[0] }} amount={p.price}/>
    <div className="rounded-[4px] bg-[var(--canvas)] p-5"><p className="text-[11px] opacity-70">판매 시작까지</p><p className="font-number my-2 text-[32px] font-bold">{hh2}:{mm2}:{ss2}</p><p className="text-[10px] opacity-70">{dateTime(p.startsAt)} · 자동 시작</p></div>
    <div className="space-y-2"><InfoRow label="판매 시작" value={dateTime(p.startsAt)}/><InfoRow label="판매 종료" value={dateTime(p.endsAt)}/><InfoRow label="최초 판매 수량" value={`${fee.initial}개`}/><InfoRow label="판매가격" value={money(p.price)}/></div>
    {now < p.startsAt ? <Link className="btn btn-outline w-full" to={`/seller/new?edit=${p.id}`}>상품 정보 수정</Link> : <Note title="핵심 정보는 변경할 수 없어요">판매 시작 후 가격·옵션·최초 수량·종료 시각은 변경할 수 없습니다.</Note>}
    <Link className="btn w-full" to={`/seller/orders?product=${p.id}`}>주문 관리</Link>
  </div>;
}

export function SellerInquiriesPage() {
  const s = useStore(), user = activeUser(s); const [tab, setTab] = useState<'order' | 'product'>('order'); const [onlyUnanswered, setOnlyUnanswered] = useState(false); if (!user.seller) return <Unavailable/>; const all = s.inquiries.filter(q => q.sellerId === user.id); const byTab = all.filter(q => tab === 'order' ? !!q.orderId : !q.orderId); const items = onlyUnanswered ? byTab.filter(q => !q.answer) : byTab;
  return <div className="space-y-0"><Header title="문의함" subtitle="고객의 상품·주문 문의에 답변해 주세요."/><div className="divider flex gap-5">{([['order', `주문 문의 ${all.filter(q => !!q.orderId).length}`], ['product', `상품 문의 ${all.filter(q => !q.orderId).length}`]] as [string, string][]).map(([t, label]) => <button key={t} onClick={() => setTab(t as 'order' | 'product')} className={`border-b-2 py-3 text-[11px] ${tab === t ? 'border-[var(--ink)] font-bold' : 'muted border-transparent'}`}>{label}</button>)}</div><div className="flex items-center gap-3 py-3 text-[11px]"><label className="flex items-center gap-2"><input type="checkbox" checked={onlyUnanswered} onChange={e => setOnlyUnanswered(e.target.checked)}/>미답변만 보기</label>{onlyUnanswered && <span className="ml-auto font-bold text-[var(--red)]">미답변 {byTab.filter(q => !q.answer).length}건</span>}</div>{items.map(q => <Link key={q.id} to={`/seller/inquiries/${q.id}`} className="divider block space-y-2 py-4"><div className="flex items-center justify-between"><Badge live={!q.answer}>{q.answer ? '답변 완료' : '답변 대기'}</Badge><span className="muted text-[10px]">{dateTime(q.createdAt)}</span></div><p className="text-[13px] font-bold">{q.productName}</p><p className="muted text-[10px]">{q.kind}{q.orderId ? ` · ${q.orderId}` : ''}</p><p className="line-clamp-2 text-[12px] leading-relaxed">{q.question}</p></Link>)}{!items.length && <Empty title="해당 조건의 문의가 없어요"/>}</div>;
}
export function SellerInquiryDetailPage() {
  const { id } = useParams(); const s = useStore(), user = activeUser(s), toast = useToast(); const q = s.inquiries.find(i => i.id === id && i.sellerId === user.id); const [answer, setAnswer] = useState(q?.answer ?? ''), [publicAnswer, setPublic] = useState(q?.public ?? false), [error, setError] = useState('');
  if (!user.seller || !q) return <Unavailable message="문의를 찾을 수 없습니다."/>;
  const buyer = s.users.find(u => u.id === q.userId); const buyerMasked = buyer?.name.replace(/^(.)(.)(.)$/, '$1*$3') ?? buyer?.name.replace(/^(.).+(.)$/, (_, a, z) => `${a}*${z}`) ?? '구매자';
  return <div className="space-y-4"><Header title="문의 상세"/>{q.orderId && <div className="rounded-[4px] bg-[var(--blue-soft)] p-3.5 space-y-1"><p className="text-[13px] font-bold">{q.productName}</p><p className="muted text-[11px]">주문번호 {q.orderId} · 구매자 {buyerMasked}</p></div>}<div className="divider space-y-3 pb-5"><div className="flex items-center justify-between"><Badge live={!q.answer}>{q.answer ? '답변 완료' : '답변 대기'}</Badge><span className="muted text-[10px]">{dateTime(q.createdAt)}</span></div><p className="text-[12px] font-bold">{q.kind}</p><p className="whitespace-pre-line text-[13px] leading-relaxed">{q.question}</p></div><Note>영업일 기준 1일 안에 답변해 주세요. 2영업일 안에 답변이 없으면 StockDrop이 직접 확인하고 구매자에게 연락해요.</Note><form className="space-y-3" onSubmit={e => { e.preventDefault(); setError(''); try { if (!answer.trim()) throw new Error('답변을 입력해 주세요.'); mutate(state => { const item = state.inquiries.find(i => i.id === id && i.sellerId === user.id); if (!item || !activeUser(state).seller) throw new Error('이 문의에 답변할 권한이 없습니다.'); item.answer = answer.trim(); item.public = !item.orderId && publicAnswer; if (item.public) { const p = state.products.find(p => p.id === item.productId); if (p) { const old = p.faqs.find(f => f.question === item.question); if (old) { old.answer = item.answer; old.confirmed = true; } else p.faqs.push({ id: uid('faq-'), question: item.question, answer: item.answer, confirmed: true }); } } }); toast('답변을 저장했습니다.'); } catch (e) { setError((e as Error).message); } }}><textarea aria-label="답변 입력" value={answer} onChange={e => setAnswer(e.target.value)} className="field field-box" placeholder="답변을 작성해 주세요." maxLength={1500}/>{!q.orderId && <label className="flex items-center gap-2 text-[11px]"><input type="checkbox" checked={publicAnswer} onChange={e => setPublic(e.target.checked)}/>공개 가능한 답변을 상품 FAQ에 반영</label>}<ErrorBox message={error}/><Button type="submit" className="w-full">답변 등록</Button></form><Link className="btn btn-outline w-full" to="/seller/inquiries">문의 목록으로</Link></div>;
}

export function SellerOrdersPage() {
  const s = useStore(), user = activeUser(s); const [params] = useSearchParams(); const [tab, setTab] = useState('전체'); if (!user.seller) return <Unavailable/>; const allOrders = s.orders.filter(o => o.sellerId === user.id && (!params.get('product') || params.get('product') === o.productId)); const orders = allOrders.filter(o => tab === '전체' || (tab === '결제 완료' && o.status === 'paid') || (tab === '배송 준비' && o.status === 'preparing') || (tab === '배송 중' && o.status === 'shipping') || (tab === '배송 완료' && o.status === 'delivered'));
  const counts: Record<string, number> = { '전체': allOrders.length, '결제 완료': allOrders.filter(o => o.status === 'paid').length, '배송 준비': allOrders.filter(o => o.status === 'preparing').length, '배송 중': allOrders.filter(o => o.status === 'shipping').length, '배송 완료': allOrders.filter(o => o.status === 'delivered').length };
  return <div className="space-y-0">
    <Header title="주문 관리"/>
    <div className="mb-2 flex flex-wrap gap-2 py-2">{Object.entries(counts).map(([label, count]) => <button key={label} onClick={() => setTab(label)} className={`rounded-full px-3 py-1 text-[13px] font-bold ${tab === label ? 'bg-[var(--ink)] text-[var(--surface)]' : 'muted border border-[var(--line)] bg-[var(--surface)]'}`}>{label} {count}</button>)}</div>
    {orders.map(o => {
      const statusLabel = ORDER_LABELS[o.status]; const needsAction = o.status === 'paid'; const time = dateTime(o.createdAt);
      return <Link to={`/seller/orders/${o.id}`} key={o.id} className="divider block space-y-3 py-5">
        <div className="flex items-center justify-between gap-2">
          <span className={`rounded-[3px] px-2 py-0.5 text-[11px] font-bold ${needsAction ? 'bg-[var(--ink)] text-[var(--surface)]' : o.status === 'delivered' ? 'bg-[#EEF8F3] text-[#3FB181]' : 'bg-[var(--soft)] text-[var(--muted)]'}`}>{statusLabel}</span>
          <span className="muted truncate text-[12px]">{o.id}</span>
          <span className="muted shrink-0 text-[12px]">{time.split(' ')[1] ?? time}</span>
        </div>
        <div className="flex gap-3">
          <ProductImage src={o.product.image} alt={o.product.name} className="h-[56px] w-[56px] shrink-0"/>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="text-[14px]">{o.product.name}</p>
            <p className="muted text-[12px]">{o.lines.map(l => `${l.name} · ${l.quantity}개`).join(' · ')} · {o.address.name.replace(/^(.)(.)(.)$/, '$1*$3').replace(/^(.).+(.)$/, (_, a, z) => `${a}*${z}`)}</p>
            <p className="font-number text-[14px] font-bold">{money(o.total)}</p>
          </div>
          <span className="muted self-center">›</span>
        </div>
      </Link>;
    })}
    {!orders.length && <Empty title="해당 상태의 주문이 없어요"/>}
  </div>;
}
export function SellerOrderPage() {
  const { id } = useParams(); const s = useStore(), user = activeUser(s), toast = useToast(), now = useClock(); const order = s.orders.find(o => o.id === id && o.sellerId === user.id); const [showTracking, setShowTracking] = useState(false), [confirm, setConfirm] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  if (!user.seller || !order) return <Unavailable message="판매자 주문을 찾을 수 없습니다."/>;
  const o = order; const paidAt = new Date(o.createdAt); const dueDate = new Date(paidAt); dueDate.setDate(dueDate.getDate() + 2); const dueDateStr = `${dueDate.getMonth()+1}.${String(dueDate.getDate()).padStart(2,'0')} (${['일','월','화','수','목','금','토'][dueDate.getDay()]})`;
  const needsTracking = ['paid', 'preparing'].includes(o.status); const orderInquiries = s.inquiries.filter(q => q.orderId === o.id && q.sellerId === user.id);
  return <div className="space-y-5">
    <Header title="주문 상세" subtitle={`${o.id} · ${new Date(o.createdAt).getMonth()+1}.${String(new Date(o.createdAt).getDate()).padStart(2,'0')} ${String(new Date(o.createdAt).getHours()).padStart(2,'0')}:${String(new Date(o.createdAt).getMinutes()).padStart(2,'0')} 결제`}/>
    {needsTracking ? <><h1 className="text-[24px] font-bold tracking-[-.7px]">송장을 등록해 주세요</h1><p className="text-[13px] text-[#7B7B7B]">결제 후 2영업일 이내 출고 · {dueDateStr}까지</p></> : <h1 className="text-[24px] font-bold tracking-[-.7px]">{o.status === 'shipping' ? '상품이 배송 중이에요' : o.status === 'delivered' ? '배송이 완료됐어요' : ORDER_LABELS[o.status]}</h1>}
    <div className="flex gap-3 rounded-[4px] bg-[var(--canvas)] p-4">
      <ProductImage src={o.product.image} alt={o.product.name} className="h-[64px] w-[64px] shrink-0"/>
      <div className="min-w-0 flex-1 space-y-1"><p className="muted text-[11px] font-bold">{o.product.brand}</p><p className="text-[14px]">{o.product.name}</p><p className="muted text-[12px]">{o.lines.map(l => l.name).join(' / ')} / {o.lines.reduce((n,l)=>n+l.quantity,0)}개</p></div>
    </div>
    <section className="divider space-y-2 pb-4"><h2 className="text-[15px] font-bold">주문 및 결제 정보</h2><InfoRow label="상품금액" value={money(o.total - o.shipping)}/><InfoRow label="고정 배송비" value={money(o.shipping)}/><InfoRow label="최종 결제금액" value={<span className="font-bold">{money(o.total)}</span>}/></section>
    <section className="divider space-y-2 pb-4"><h2 className="text-[15px] font-bold">배송지</h2><p className="text-[12px]">{o.address.name} · {o.address.phone}</p><p className="muted text-[12px] leading-relaxed">{o.address.address} {o.address.detail}<br/>{o.address.request}</p></section>
    <section className="divider space-y-2 pb-4"><h2 className="text-[15px] font-bold">배송 처리</h2><InfoRow label="출고지" value={s.sellerSettings[user.id]?.shippingAddress || '성수 물류창고'}/><InfoRow label="택배사" value={o.carrier || <span className="text-[var(--muted)]">미등록</span>}/><InfoRow label="운송장 번호" value={o.tracking ? <span className="inline-flex items-center gap-1">{o.tracking}<CopyButton value={o.tracking}/></span> : <span className="text-[var(--muted)]">미등록</span>}/></section>
    <Note>송장을 등록하면 구매자에게 배송 중으로 안내돼요. 판매자의 수동 배송완료 처리는 구매확정이나 정산 송금을 의미하지 않습니다.</Note>
    {orderInquiries.length > 0 && <Link to={`/seller/inquiries/${orderInquiries[0].id}`} className="flex items-center gap-3 rounded-[4px] border border-[var(--line)] p-4"><div className="flex-1 space-y-1"><p className="text-[13px] font-bold">이 주문의 문의</p><p className="muted text-[12px]">{orderInquiries[0].kind} 문의 {orderInquiries.length}건</p></div>{orderInquiries.some(q => !q.answer) && <span className="rounded-[3px] bg-[var(--red-soft)] px-2 py-0.5 text-[11px] font-bold text-[var(--red)]">미답변 {orderInquiries.filter(q => !q.answer).length}</span>}<ChevronRight size={16} className="muted"/></Link>}
    <section className="divider space-y-3 py-3"><h2 className="text-[15px] font-bold">배송 진행 내역</h2>{o.processedAt && <InfoRow label={dateTime(o.processedAt)} value="배송완료 · 판매자 수동 등록"/>}{o.shippedAt && <InfoRow label={dateTime(o.shippedAt)} value="운송장 등록 · 배송 중"/>}<InfoRow label={dateTime(o.createdAt)} value="결제 완료"/></section>
    <ErrorBox message={error}/>
    <div className="flex gap-2">
      {o.status === 'shipping' ? <><Button outline className="flex-[1]" onClick={() => setConfirm(true)}>배송완료 확인</Button><Button className="flex-[2]" onClick={() => setShowTracking(true)}>송장 등록</Button></> : needsTracking ? <><Button outline className="flex-[1]" onClick={() => setConfirm(true)} disabled>배송완료</Button><Button className="flex-[2]" onClick={() => setShowTracking(true)}>송장 등록</Button></> : <Button className="w-full" disabled>{ORDER_LABELS[o.status]}</Button>}
    </div>
    {showTracking && <TrackingModal order={o} onClose={() => setShowTracking(false)} onSaved={() => { setShowTracking(false); toast('운송장을 등록했습니다.'); }}/>}
    {confirm && <DeliveredModal order={o} now={now} onClose={() => setConfirm(false)}/>}
  </div>;
}
function TrackingModal({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const [carrier, setCarrier] = useState(order.carrier || 'CJ대한통운'), [tracking, setTracking] = useState(order.tracking || ''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <Modal title="송장 등록" onClose={onClose}><div className="space-y-4">
    <div className="rounded-[4px] bg-[var(--canvas)] p-3 space-y-1">
      <p className="muted text-[11px] font-bold">{order.id} · {order.address.name.replace(/^(.)(.)(.)$/, '$1*$3').replace(/^(.).+(.)$/, (_,a,z) => `${a}*${z}`)}</p>
      <p className="text-[14px]">{order.product.name} · {order.lines.reduce((n,l)=>n+l.quantity,0)}개</p>
      <p className="muted text-[12px]">{order.lines.map(l=>l.name).join(' / ')} · 출고지 {order.product.brand}</p>
    </div>
    <Field label="택배사" required><select aria-label="택배사" value={carrier} onChange={e => setCarrier(e.target.value)} className="field">{['CJ대한통운','한진택배','롯데택배','우체국택배'].map(c => <option key={c}>{c}</option>)}</select></Field>
    <Field label="운송장 번호" required><input aria-label="운송장 번호" inputMode="numeric" value={tracking} onChange={e => { setTracking(e.target.value); setError(''); }} className="field" placeholder="숫자만 입력"/></Field>
    {error && <p className="text-[12px] text-[#EF6253]">{error} 입력한 내용은 그대로 유지돼요.</p>}
    <Note>'-' 없이 숫자만 입력해 주세요. 등록하면 구매자에게 배송 시작 알림이 발송돼요.</Note>
    <ErrorBox message=""/>
    <div className="flex gap-2"><Button outline className="flex-1" disabled={busy} onClick={onClose}>취소</Button><Button className="flex-1" disabled={busy || !tracking.trim()} onClick={async () => { setError(''); setBusy(true); try { if (!/^\d[\d-]{7,}$/.test(tracking.trim())) throw new Error('운송장 번호를 확인해 주세요.'); await atomic(state => { const item = state.orders.find(item => item.id === order.id && item.sellerId === state.activeUserId); if (!item || !['paid','preparing'].includes(item.status)) throw new Error('출고 가능한 주문이 아닙니다.'); item.carrier = carrier; item.tracking = tracking.trim(); item.shippedAt = nowOf(state); item.status = 'shipping'; }); onSaved(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>등록하기</Button></div>
  </div></Modal>;
}
function DeliveredModal({ order, now, onClose }: { order: Order; now: number; onClose: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false); const toast = useToast();
  return <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background: 'rgba(0,0,0,0.45)'}} onClick={e => e.target === e.currentTarget && !busy && onClose()}><div className="mx-4 w-full max-w-[318px] rounded-[8px] bg-[var(--surface)] p-5 space-y-4">
    <h2 className="text-[17px] font-bold tracking-[-.4px]">배송완료로 처리할까요?</h2>
    <p className="text-[13px] text-[#7B7B7B]">처리하면 구매자에게 배송 완료로 안내돼요.</p>
    <div className="rounded-[4px] bg-[var(--canvas)] p-3 space-y-1">
      <p className="muted text-[12px] font-bold">{order.id} · {order.address.name.replace(/^(.)(.)(.)$/, '$1*$3').replace(/^(.).+(.)$/, (_,a,z) => `${a}*${z}`)}</p>
      <p className="text-[13px]">{order.product.name} · {order.lines.map(l=>l.name).join(' / ')} / {order.lines.reduce((n,l)=>n+l.quantity,0)}개</p>
      {order.tracking && <p className="muted text-[12px]">{order.carrier} {order.tracking}</p>}
    </div>
    <p className="text-[11px] text-[#949494] leading-relaxed">판매자의 수동 배송완료 처리는 구매확정이나 정산 송금을 의미하지 않습니다.</p>
    <ErrorBox message={error}/>
    <div className="flex gap-2"><Button outline className="flex-1" disabled={busy} onClick={onClose}>취소</Button><Button className="flex-1" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await atomic(s => markDelivered(s, s.activeUserId, order.id, nowOf(s), '문 앞', '', true, nowOf(s))); toast('배송완료로 처리했습니다.'); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>배송완료 처리</Button></div>
  </div></div>;
}

export function SellerMyPage() {
  const s = useStore(), user = activeUser(s), navigate = useNavigate();
  if (!user.seller) return <Unavailable/>;
  const settings = s.sellerSettings[user.id];
  const displayName = settings?.displayName ?? user.name;
  const initial = displayName.charAt(0).toUpperCase();
  const products = s.products.filter(p => p.sellerId === user.id);
  const activeDrops = products.filter(p => saleState(p, Date.now()) === '판매 중' || saleState(p, Date.now()) === '판매 예정').length;
  const settlement = s.orders.filter(o => o.sellerId === user.id && !['cancelled','refunded'].includes(o.status)).reduce((n, o) => n + o.total - o.shipping, 0);
  const unanswered = s.inquiries.filter(q => q.sellerId === user.id && !q.answer).length;
  const maskedBank = settings?.account ? `국민 ****${settings.account.slice(-4)}` : '국민 ****1024';
  return (
    <div className="space-y-0">
      <Header title="판매자 마이페이지" subtitle="스토어 정보와 판매 설정을 관리하세요." back={false}/>
      <div className="divider flex items-center gap-3 pb-5">
        <div className="grid h-[48px] w-[48px] shrink-0 place-items-center rounded-[8px] bg-[var(--ink)] text-[18px] font-bold text-white">{initial}</div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-bold">{displayName}</h2>
            <span className="rounded-[3px] bg-[var(--green-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--green)]">승인 판매자</span>
          </div>
          <p className="muted text-[12px]">{user.name} · {user.email}</p>
        </div>
        <ChevronRight size={17} className="muted shrink-0"/>
      </div>
      <div className="mb-4 flex rounded-[4px] bg-[var(--canvas)]">
        {([['진행 중 드롭', `${activeDrops}건`, '/seller/products'], ['이번 달 정산 예정', money(settlement), '/seller/settings/bank'], ['미답변 문의', `${unanswered}건`, '/seller/inquiries', unanswered > 0]] as [string, string, string, boolean?][]).map(([label, value, to, red], i) => (
          <Link key={label} to={to} className={`flex flex-1 flex-col items-center gap-1 py-4 ${i > 0 ? 'border-l border-[var(--line)]' : ''}`}>
            <span className={`font-number text-[15px] font-bold ${red ? 'text-[var(--red)]' : ''}`}>{value}</span>
            <span className="muted text-[11px]">{label}</span>
          </Link>
        ))}
      </div>
      <section className="mb-4">
        <p className="muted mb-2 text-[13px] font-bold">판매 관리</p>
        <MenuRow to="/seller/products" label="판매 상품 관리"><span className="muted mr-1 text-[12px]">{products.length}개</span></MenuRow>
        <MenuRow to="/seller/new" label="새 한정 판매 등록"/>
      </section>
      <div className="h-2 bg-[var(--canvas)]"/>
      <section className="mb-4">
        <p className="muted mb-2 mt-4 text-[13px] font-bold">판매자 정보</p>
        <MenuRow to="/seller/settings/business" label="사업자 서류 · 담당자 정보"/>
        <MenuRow to="/seller/settings/bank" label="정산 계좌 관리"><span className="muted mr-1 text-[12px]">{maskedBank}</span></MenuRow>
        <MenuRow to="/seller/settings/addresses" label="출고지 · 반품지 관리"/>
      </section>
      <div className="h-2 bg-[var(--canvas)]"/>
      <section className="mb-4">
        <p className="muted mb-2 mt-4 text-[13px] font-bold">설정</p>
        <MenuRow to="/seller/settings/account" label="알림 설정"/>
        <MenuRow to="/seller/support" label="이용 안내 · 고객지원"/>
        <button className="divider flex min-h-[52px] w-full items-center gap-3 text-left" onClick={() => { mutate(state => { state.mode = 'buyer'; }); navigate('/'); }}><span className="min-w-0 flex-1 text-[13px]">구매자 모드로 전환</span><ChevronRight size={17} className="muted"/></button>
      </section>
      <div className="text-center"><LogoutButton/></div>
    </div>
  );
}
export function SellerSettingsPage() {
  const { section } = useParams();
  const s = useStore(), user = activeUser(s), toast = useToast(), navigate = useNavigate();
  const original = s.sellerSettings[user.id];
  const [form, setForm] = useState<SellerSettings>(original ?? { displayName: user.name, bank: '', account: '', holder: user.name, shippingAddress: '', returnAddress: '', notifications: {} });
  const [phone, setPhone] = useState(user.phone), [email, setEmail] = useState(user.email), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const app = s.applications.find(a => a.userId === user.id && a.status === 'approved');
  const [shipCarrier, setShipCarrier] = useState('CJ대한통운');
  const [shipPickup, setShipPickup] = useState('평일 16:00');
  const [returnFee, setReturnFee] = useState('3000');
  const [exchangeFee, setExchangeFee] = useState('6000');
  const [addrTab, setAddrTab] = useState<'ship' | 'return'>('ship');
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [sameAsShip, setSameAsShip] = useState(false), [defaultReturn, setDefaultReturn] = useState(false);

  useEffect(() => {
    apiGet('/sellers/me').then((me: any) => {
      if (!me) return;
      setForm(f => ({ ...f, displayName: me.sellerDisplayName ?? f.displayName, bank: me.bankAccount?.bankName ?? f.bank, account: me.bankAccount?.maskedBankAccount ?? f.account, holder: me.bankAccount?.accountHolderName ?? f.holder, shippingAddress: me.dispatchAddress?.roadAddress ?? f.shippingAddress, shippingPostal: me.dispatchAddress?.postalCode ?? f.shippingPostal, returnAddress: me.returnAddress?.roadAddress ?? f.returnAddress, returnPostal: me.returnAddress?.postalCode ?? f.returnPostal }));
      if (me.contactPhone) setPhone(me.contactPhone);
      if (me.contactEmail) setEmail(me.contactEmail);
    }).catch(() => {});
  }, []);

  if (!user.seller) return <Unavailable/>;

  const change = (key: keyof SellerSettings, value: string) => setForm({ ...form, [key]: value });
  const inputField = (key: 'displayName' | 'bank' | 'account' | 'holder' | 'shippingPostal' | 'shippingAddress' | 'returnPostal' | 'returnAddress', label: string, extra?: { hint?: string; required?: boolean }) =>
    <Field label={label} hint={extra?.hint} required={extra?.required}><input aria-label={label} value={(form[key] as string) ?? ''} onChange={e => change(key, e.target.value)} className="field"/></Field>;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      if (section === 'bank' && (!form.bank.trim() || !form.account.trim() || !form.holder.trim())) throw new Error('은행·계좌번호·예금주를 확인해 주세요.');
      if (section === 'addresses' && (!form.shippingAddress.trim() || !form.returnAddress.trim())) throw new Error('출고지와 반품지 주소를 입력해 주세요.');
      if (section === 'returns' && !form.returnAddress.trim()) throw new Error('반품지 주소를 입력해 주세요.');
      if (section === 'account' || section === 'business') { if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('올바른 이메일을 입력해 주세요.'); }
      if (section === 'business') { await apiPut('/sellers/me/contact', { sellerDisplayName: form.displayName, contactName: user.name, contactEmail: email, contactPhone: phone }); }
      else if (section === 'bank') { await apiPut('/sellers/me/bank-account', { bankName: form.bank, bankAccount: form.account, accountHolderName: form.holder }); }
      else if (section === 'addresses' || section === 'returns') { await apiPut('/sellers/me/addresses', { dispatchAddress: { postalCode: form.shippingPostal || '', roadAddress: form.shippingAddress, detailAddress: '' }, returnAddress: { postalCode: form.returnPostal || '', roadAddress: form.returnAddress, detailAddress: '' } }); }
      else if (section === 'account') { await apiPut('/sellers/me/contact', { contactName: user.name, contactEmail: email, contactPhone: phone }); }
      mutate(state => { state.sellerSettings[user.id] = form; const member = state.users.find(u => u.id === user.id)!; member.phone = phone; member.email = email; });
      toast('변경 내용을 저장했습니다.');
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  // ── 사업자 서류 · 담당자 정보 ──────────────────────────────
  if (section === 'business') return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Header title="사업자 서류 · 담당자 정보"/>
      <section className="space-y-4">
        <h2 className="text-[13px] font-bold text-[var(--muted)]">사업자 서류</h2>
        <div className="divider flex items-center gap-3 pb-4">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-[6px] bg-[var(--canvas)]"><FileText size={18} className="muted"/></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2"><span className="text-[14px] font-bold">사업자등록증</span><span className="rounded-[3px] bg-[var(--green-soft)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--green)]">확인 완료</span></div>
            <p className="muted mt-0.5 text-[12px]">lomfield_biz.pdf · 2026.05.02 업로드</p>
          </div>
          <button type="button" className="h-8 shrink-0 rounded-[4px] border border-[var(--line)] px-2.5 text-[12px] font-bold">보기</button>
        </div>
        {form.business && <div className="space-y-1.5 px-2 text-[12px]">
          {form.business.name && <InfoRow label="상호" value={form.business.name}/>}
          {form.business.registrationNumber && <InfoRow label="사업자등록번호" value={form.business.registrationNumber}/>}
          {form.business.representative && <InfoRow label="대표자" value={form.business.representative}/>}
          {form.business.businessType && <InfoRow label="업태 · 종목" value={form.business.businessType}/>}
        </div>}
        <p className="muted px-1 text-[12px]">사업자 정보 변경은 고객지원으로 요청해 주세요.</p>
      </section>
      <div className="-mx-4 h-px bg-[var(--line)]"/>
      <section className="space-y-4">
        <h2 className="text-[13px] font-bold text-[var(--muted)]">담당자 정보</h2>
        <Field label="담당자 이름" required><input aria-label="담당자 이름" className="field-line" value={user.name} readOnly/></Field>
        <Field label="연락처" required hint="출고 · 정산 관련 긴급 연락에 사용돼요."><input aria-label="연락처" className="field-line" value={phone} onChange={e => setPhone(e.target.value)} type="tel"/></Field>
        <Field label="업무 이메일" required><input aria-label="업무 이메일" className="field-line" value={email} onChange={e => setEmail(e.target.value)} type="email"/></Field>
      </section>
      <ErrorBox message={error}/>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? '저장 중…' : '저장하기'}</Button>
    </form>
  );

  // ── 정산 계좌 관리 ──────────────────────────────────────────
  if (section === 'bank') return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Header title="정산 계좌 관리"/>
      <h2 className="text-[13px] font-bold text-[var(--muted)]">현재 정산 계좌</h2>
      <section className="rounded-[8px] bg-[var(--canvas)] p-5">
        <div>
          <div className="flex items-center justify-between"><p className="muted text-[13px]">{form.bank || 'KB국민은행'}</p><span className="flex items-center gap-1 rounded-[3px] bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-[var(--green)]"><Check size={11}/>인증 완료</span></div>
          <p className="font-number text-[22px] font-bold mt-1">123456-04-***024</p>
          <p className="muted text-[11px] mt-1">예금주 로엠필드(김서윤) · 2026.05.08 등록</p>
        </div>
      </section>
      <div className="space-y-2">
        <InfoRow label="정산 주기" value="구매 확정 후 D+7 영업일"/>
        <InfoRow label="다음 정산 예정일" value="2026.11.11 (수)"/>
        <InfoRow label="정산 예정 금액" value={<span className="font-bold">1,284,000원</span>}/>
        <button type="button" className="flex items-center pt-1 text-[13px] font-bold">정산 내역 보기<ChevronRight size={15}/></button>
      </div>
      <div className="-mx-4 h-px bg-[var(--line)]"/>
      <h2 className="text-[13px] font-bold text-[var(--muted)]">계좌 변경</h2>
      <Field label="은행" required><select aria-label="은행" value={form.bank || ''} onChange={e => change('bank', e.target.value)} className="field-line"><option value="">은행을 선택해 주세요</option>{['KB국민은행','신한은행','우리은행','하나은행','IBK기업은행','NH농협은행','카카오뱅크','토스뱅크'].map(b => <option key={b}>{b}</option>)}</select></Field>
      <Field label="계좌번호" required><input aria-label="계좌번호" className="field-line" inputMode="numeric" value={form.account ?? ''} onChange={e => change('account', e.target.value)} placeholder="'-' 없이 숫자만 입력"/></Field>
      <Field label="예금주" hint="사업자등록증의 상호 또는 대표자명과 같아야 해요"><input aria-label="예금주" className="field-line" value={form.holder ?? ''} onChange={e => change('holder', e.target.value)}/></Field>
      <div className="flex gap-2 rounded-[6px] bg-[var(--canvas)] p-4 text-[12px] text-[#7B7B7B]"><Info size={15} className="mt-px shrink-0"/><p>1원 입금으로 본인 계좌를 확인해요. 변경한 계좌는 다음 정산부터 적용돼요.</p></div>
      <ErrorBox message={error}/>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? '저장 중…' : '계좌 인증하고 변경'}</Button>
    </form>
  );

  // ── 출고지 · 반품지 관리 ────────────────────────────────────
  if (section === 'addresses') return (
    <div className="space-y-0">
      <Header title="출고지 · 반품지 관리"/>
      <p className="muted mb-4 text-[12px] leading-relaxed">드롭 상품은 기본 출고지에서 발송돼요. 상품별로 다른<br/>출고지를 지정할 수도 있어요.</p>
      <div className="mb-4 flex border-b border-[var(--line)]">
        {(['ship', 'return'] as const).map((t, i) => (
          <button key={t} onClick={() => setAddrTab(t)} className={`flex-1 border-b-2 py-3 text-[13px] font-bold ${addrTab === t ? 'border-[var(--ink)]' : 'border-transparent muted'}`}>
            {t === 'ship' ? '출고지 2' : '반품지 1'}
          </button>
        ))}
      </div>
      {addrTab === 'ship' && (
        <div className="space-y-3">
          {[
            { name: '성수 물류창고', isDefault: true, address: '서울 성동구 성수이로 118, 3층 (04782)', person: '김서윤 · 010-2481-****' },
            { name: '파주 보관센터', isDefault: false, address: '경기 파주시 문발로 242, B동 (10881)', person: '박도현 · 031-944-****' },
          ].map(loc => (
            <div key={loc.name} className="rounded-[8px] border border-[var(--line)] p-4 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-[14px] font-bold">{loc.name}</p>
                  {loc.isDefault && <span className="rounded-full bg-[var(--canvas)] px-2 py-0.5 text-[10px] font-bold">기본</span>}
                </div>
                <div className="flex gap-2">
                  {!loc.isDefault && <button className="muted text-[12px]">기본 설정</button>}
                  <Link to="/seller/settings/ship-edit" className="text-[12px] font-bold">수정</Link>
                  {!loc.isDefault && <button onClick={() => setDeleteConfirm(true)} className="text-[12px] text-[var(--red)]">삭제</button>}
                </div>
              </div>
              <p className="muted text-[12px]">{loc.address}</p>
              <p className="muted text-[12px]">{loc.person}</p>
            </div>
          ))}
          <button className="btn btn-outline w-full">출고지 추가</button>
        </div>
      )}
      {addrTab === 'return' && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="muted text-[12px]">반품지를 기본 출고지와 동일하게</p>
            <button onClick={() => { change('returnAddress', form.shippingAddress); setForm(f => ({ ...f, returnPostal: f.shippingPostal })); toast('반품지를 출고지와 동일하게 설정했습니다.'); }} className="muted text-[12px] underline">적용</button>
          </div>
          <div className="rounded-[8px] border border-[var(--line)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[14px] font-bold">성수 물류창고</p>
                <span className="rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[10px] font-bold text-[var(--green)]">출고지와 동일</span>
              </div>
              <div className="flex gap-2">
                <Link to="/seller/settings/returns" className="text-[12px] font-bold">수정</Link>
                <button className="text-[12px] text-[var(--red)]">삭제</button>
              </div>
            </div>
            <p className="muted text-[12px]">서울 성동구 성수이로 118, 3층 (04782)</p>
            <p className="muted text-[12px]">김서윤 · 010-2481-****</p>
          </div>
          <Link to="/seller/settings/returns" className="btn btn-outline block w-full text-center">반품지 추가</Link>
        </div>
      )}
      <div className="mt-6 rounded-[8px] bg-[var(--canvas)] p-4 space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-[14px] font-bold">반품 · 교환 설정</p>
        </div>
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-[14px]">반품지를 기본 출고지와 동일하게</p><p className="muted text-[12px]">성수 물류창고로 반품을 받아요</p></div>
          <Toggle label="반품지를 기본 출고지와 동일하게" checked={!form.returnAddress || form.returnAddress === form.shippingAddress} onChange={on => change('returnAddress', on ? form.shippingAddress ?? '' : '파주 보관센터')}/>
        </div>
        <InfoRow label="반품 택배사" value="CJ대한통운"/>
        <InfoRow label="반품 배송비 (편도)" value="3,000원"/>
        <InfoRow label="교환 배송비 (왕복)" value="6,000원"/>
        <Link to="/seller/settings/shipping" className="btn btn-outline block w-full text-center text-[12px]!">택배사 · 배송비 변경</Link>
      </div>
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{background:'rgba(0,0,0,0.45)'}} onClick={e => e.target === e.currentTarget && setDeleteConfirm(false)}>
          <div className="mx-4 w-full max-w-[318px] rounded-[8px] bg-[var(--surface)] p-5 space-y-4">
            <h2 className="text-[17px] font-bold">출고지를 삭제할까요?</h2>
            <p className="text-[13px] text-[var(--muted)]">이 출고지로 지정된 판매 예정 드롭 1건은<br/>기본 출고지(성수 물류창고)로 바뀌어요.</p>
            <div className="rounded-[4px] bg-[var(--canvas)] p-3 space-y-1">
              <p className="text-[13px] font-bold">파주 보관센터</p>
              <p className="muted text-[12px]">[10881] 경기 파주시 문발로 242, B동</p>
            </div>
            <div className="flex gap-2">
              <Button outline className="flex-1" onClick={() => setDeleteConfirm(false)}>취소</Button>
              <Button className="flex-1" onClick={() => { toast('출고지를 삭제했습니다.'); setDeleteConfirm(false); }}>삭제</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── 출고지 수정 ──────────────────────────────────────────────
  if (section === 'ship-edit') return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Header title="출고지 수정"/>
      <Field label="출고지명"><input aria-label="출고지명" className="field" defaultValue="성수 물류창고"/></Field>
      <Field label="출고 담당자" required><input aria-label="출고 담당자" className="field" value={user.name} readOnly/></Field>
      <Field label="연락처" required><input aria-label="연락처" className="field" value={phone} onChange={e => setPhone(e.target.value)} type="tel"/></Field>
      <Field label="주소" required>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input aria-label="우편번호" className="field flex-1" defaultValue="04782" readOnly/>
            <button type="button" className="btn btn-outline shrink-0 text-[12px]!">주소 검색</button>
          </div>
          <input aria-label="도로명 주소" className="field" defaultValue="서울특별시 성동구 성수이로 118"/>
          <input aria-label="상세 주소" className="field" defaultValue="3층 물류팀"/>
        </div>
      </Field>
      <Field label="택배 집하 시간">
        <select aria-label="택배 집하 시간" defaultValue="평일 16:00" className="field">
          {['평일 14:00', '평일 15:00', '평일 16:00 · CJ대한통운', '평일 17:00'].map(t => <option key={t}>{t}</option>)}
        </select>
      </Field>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-4 w-4" defaultChecked/>
        <div>
          <p className="text-[13px] font-bold">기본 출고지로 설정</p>
          <p className="muted text-[11px]">새 드롭 상품의 출고지로 자동 지정돼요</p>
        </div>
      </label>
      <ErrorBox message={error}/>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? '저장 중…' : '저장하기'}</Button>
    </form>
  );

  // ── 반품지 관리 (별도 페이지) ───────────────────────────────
  if (section === 'returns') return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Header title="반품지 추가"/>
      <div className="flex items-center gap-3 rounded-[8px] bg-[var(--canvas)] p-3">
        <div className="flex-1">
          <p className="text-[13px] font-bold">반품지를 기본 출고지와 동일하게</p>
          <p className="muted text-[11px]">성수 물류창고 주소를 그대로 불러와요</p>
        </div>
        <Toggle label="반품지를 기본 출고지와 동일하게" checked={sameAsShip} onChange={on => { setSameAsShip(on); if (on) setForm(f => ({ ...f, returnAddress: f.shippingAddress, returnPostal: f.shippingPostal })); }}/>
      </div>
      <Field label="반품지명" required><input aria-label="반품지명" className="field" value={form.returnAddress ? '파주 보관센터' : ''} onChange={() => {}} placeholder="파주 보관센터"/></Field>
      <Field label="반품 담당자" required><input aria-label="반품 담당자" className="field" value={user.name} readOnly/></Field>
      <Field label="연락처" required hint="반품 · 교환 관련 연락에 사용돼요."><input aria-label="연락처" className="field" value={phone} onChange={e => setPhone(e.target.value)} type="tel"/></Field>
      <Field label="주소" required>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input aria-label="우편번호" className="field flex-1" value={form.returnPostal ?? ''} onChange={e => change('returnPostal', e.target.value)} placeholder="10881"/>
            <button type="button" className="btn btn-outline shrink-0 text-[12px]!">주소 검색</button>
          </div>
          <input aria-label="도로명 주소" className="field" value={form.returnAddress ?? ''} onChange={e => change('returnAddress', e.target.value)} placeholder="경기 파주시 문발로 242"/>
          <input aria-label="상세 주소" className="field" placeholder="B동"/>
        </div>
      </Field>
      <div className="flex items-center gap-3 rounded-[8px] bg-[var(--canvas)] p-3">
        <div className="flex-1">
          <p className="text-[13px] font-bold">기본 반품지로 설정</p>
          <p className="muted text-[11px]">구매자 반품 접수 시 이 주소로 안내돼요</p>
        </div>
        <Toggle label="기본 반품지로 설정" checked={defaultReturn} onChange={setDefaultReturn}/>
      </div>
      <ErrorBox message={error}/>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? '저장 중…' : '저장하기'}</Button>
    </form>
  );

  // ── 배송 설정 변경 ──────────────────────────────────────────
  if (section === 'shipping') return (
    <form className="space-y-5" onSubmit={async e => { e.preventDefault(); toast('배송 설정을 저장했습니다.'); }}>
      <Header title="택배사 · 배송비 변경"/>
      <Field label="반품 택배사" required><select aria-label="반품 택배사" value={shipCarrier} onChange={e => setShipCarrier(e.target.value)} className="field rounded-[6px] border px-4 text-[15px]">{['CJ대한통운', '한진택배', '롯데택배', '우체국택배'].map(c => <option key={c}>{c}</option>)}</select></Field>
      <Field label="택배 집하 시간" required><select aria-label="택배 집하 시간" value={shipPickup} onChange={e => setShipPickup(e.target.value)} className="field rounded-[6px] border px-4 text-[15px]">{['평일 14:00', '평일 15:00', '평일 16:00', '평일 17:00'].map(t => <option key={t}>{t}</option>)}</select></Field>
      <Field label="반품 배송비 (편도)" required><input aria-label="반품 배송비" type="number" inputMode="numeric" min={0} step={500} value={returnFee} onChange={e => setReturnFee(e.target.value)} className="field-line"/></Field>
      <Field label="교환 배송비 (왕복)" required><input aria-label="교환 배송비" type="number" inputMode="numeric" min={0} step={500} value={exchangeFee} onChange={e => setExchangeFee(e.target.value)} className="field-line"/></Field>
      <div className="space-y-1 rounded-[6px] bg-[var(--canvas)] p-4"><p className="text-[13px] font-bold">변경 내용은 새로 등록하는 드롭부터 적용돼요</p><p className="muted text-[12px]">이미 등록된 상품은 등록 시점의 배송 설정을 유지해요.</p></div>
      <Button type="submit" className="w-full">저장하기</Button>
    </form>
  );

  // ── 계정 설정 (account) ─────────────────────────────────────
  if (section === 'account') return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Header title="계정 설정"/>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          <div className="grid h-[64px] w-[64px] place-items-center rounded-[8px] bg-[var(--ink)] text-[24px] font-bold text-white">L</div>
          <button type="button" aria-label="로고 변경" className="absolute -bottom-1 -right-1 grid h-[26px] w-[26px] place-items-center rounded-full border border-[var(--line)] bg-[var(--surface)]">
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="1" y="2.5" width="11" height="8.5" rx="1.5" stroke="#7B7B7B" strokeWidth="1.2"/><path d="M4.5 2.5V2a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v.5" stroke="#7B7B7B" strokeWidth="1.2"/><circle cx="6.5" cy="6.75" r="1.75" stroke="#7B7B7B" strokeWidth="1.2"/></svg>
          </button>
        </div>
        <div className="space-y-1">
          <p className="text-[14px] font-bold">스토어 로고</p>
          <p className="muted text-[12px]">사업자 프로필을 등록할 수 있습니다.</p>
        </div>
      </div>
      <Field label="스토어 이름" required>
        <div className="relative">
          <input aria-label="스토어 이름" className="field-line pr-10" value={form.displayName ?? ''} onChange={e => change('displayName', e.target.value)}/>
          <button type="button" aria-label="지우기" onClick={() => change('displayName', '')} className="absolute right-3 top-1/2 -translate-y-1/2"><svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7" stroke="#949494" strokeWidth="1.2"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#949494" strokeWidth="1.2" strokeLinecap="round"/></svg></button>
        </div>
        <p className="muted mt-1 text-[12px]">이름 변경은 30일에 한 번 가능해요</p>
      </Field>
      <Field label="스토어 한 줄 소개">
        <div className="relative">
          <input aria-label="스토어 한 줄 소개" className="field-line pr-14" placeholder="오래 입는 기본 니트를 만듭니다" maxLength={40}/>
          <span className="muted absolute right-3 top-1/2 -translate-y-1/2 text-[12px]">0/40</span>
        </div>
      </Field>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? '저장 중…' : '저장하기'}</Button>
      <div className="h-px bg-[var(--line)]"/>
      <h2 className="text-[13px] font-bold text-[var(--muted)]">로그인 정보</h2>
      <div className="divider flex items-center justify-between py-4">
        <span className="text-[15px]">로그인 이메일</span>
        <div className="flex items-center gap-2">
          <span className="muted text-[12px]">{user.email}</span>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><rect x="1" y="4" width="11" height="8" rx="1.5" stroke="#949494" strokeWidth="1.2"/><path d="M3 4V3a3 3 0 0 1 6 0v1" stroke="#949494" strokeWidth="1.2"/></svg>
        </div>
      </div>
      <div className="divider flex items-center justify-between py-4">
        <span className="text-[15px]">비밀번호 변경</span>
        <div className="flex items-center gap-2">
          <span className="muted text-[12px]">마지막 변경 2026.08.12</span>
          <ChevronRight size={16} className="muted"/>
        </div>
      </div>
      <ErrorBox message={error}/>
      <div className="flex gap-4 justify-center pt-2 text-[12px]">
        <LogoutButton/>
        <Link to="/seller/settings/withdraw" className="muted py-4 text-[12px] underline underline-offset-4">계정 탈퇴</Link>
      </div>
    </form>
  );

  // ── 회원 탈퇴 ───────────────────────────────────────────────
  if (section === 'withdraw') return (
    <form className="space-y-5" onSubmit={e => { e.preventDefault(); toast('탈퇴 처리 중입니다.'); }}>
      <Header title="회원 탈퇴"/>
      <h2 className="text-[18px] font-bold">탈퇴 전에 꼭 확인해 주세요.</h2>
      <div className="rounded-[8px] bg-[var(--canvas)] p-4 space-y-3">
        {[['진행 중인 주문', '없음'], ['정산 대기 금액', '0원'], ['판매 중인 드롭', '없음']].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-[13px]">{label}</span>
            <span className="muted text-[13px]">{value}</span>
          </div>
        ))}
      </div>
      <Note>진행 중인 거래가 있으면 완료된 뒤에 탈퇴할 수 있어요</Note>
      <div className="space-y-3">
        <p className="text-[13px] font-bold">탈퇴하면 이렇게 돼요</p>
        {['계정 정보, 배송지, 알림 설정이 바로 삭제돼요', '보유한 적립금과 쿠폰은 소멸되고 복구할 수 없어요', '주문·결제 기록은 관계 법령에 따라 5년간 보관돼요', '같은 이메일로는 30일 후에 다시 가입할 수 있어요'].map(text => (
          <div key={text} className="flex items-start gap-2">
            <span className="mt-0.5 text-[var(--muted)]">·</span>
            <p className="text-[13px] leading-relaxed">{text}</p>
          </div>
        ))}
      </div>
      <Field label="탈퇴 사유">
        <select aria-label="탈퇴 사유" className="field"><option>사용 빈도가 낮아요</option><option>다른 사유</option></select>
      </Field>
      <Field label="비밀번호 확인" required><input aria-label="비밀번호 확인" className="field" type="password" placeholder="••••••••"/></Field>
      <label className="flex items-center gap-3">
        <input type="checkbox" className="h-4 w-4"/>
        <span className="text-[13px]">안내 사항을 모두 확인했고 탈퇴에 동의해요</span>
      </label>
      <Button type="submit" className="w-full">탈퇴하기</Button>
    </form>
  );

  // ── 알림 설정 fallback ──────────────────────────────────────
  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <Header title="알림 설정"/>
      {['신규주문', '문의', '판매일정', '마케팅'].map(key => (
        <label key={key} className="divider flex min-h-[60px] items-center justify-between gap-4">
          <span>{({ 신규주문: '신규 주문', 문의: '상품 · 주문 문의', 판매일정: '판매 시작 · 종료', 마케팅: '혜택 및 이벤트' } as Record<string, string>)[key]}</span>
          <input role="switch" aria-label={key + ' 알림'} type="checkbox" className="h-5 w-5" checked={form.notifications[key] ?? false} onChange={e => setForm({ ...form, notifications: { ...form.notifications, [key]: e.target.checked } })}/>
        </label>
      ))}
      <ErrorBox message={error}/>
      <Button type="submit" className="w-full" disabled={busy}>{busy ? '저장 중…' : '수정 내용 저장'}</Button>
    </form>
  );
}
export function SellerSupportPage() {
  const faqs: [string, string][] = [
    ['정산', '정산은 언제 입금되나요?'],
    ['출고', '출고 마감 시간을 넘기면 어떻게 되나요?'],
    ['검수', '검수에서 반려되면 다시 신청할 수 있나요?'],
    ['반품', '구매자가 반품을 요청하면?'],
  ];
  return (
    <div className="space-y-0">
      <Header title="이용 안내 · 고객지원"/>
      <label className="mb-5 flex h-10 items-center gap-2.5 rounded-[6px] bg-[var(--canvas)] px-3.5">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none" className="muted shrink-0"><circle cx="8" cy="8" r="6" stroke="#949494" strokeWidth="1.5"/><path d="M13 13l3 3" stroke="#949494" strokeWidth="1.5" strokeLinecap="round"/></svg>
        <input aria-label="고객지원 검색" placeholder="정산, 출고, 검수 기준 검색" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--muted)]" readOnly/>
      </label>
      <section className="mb-5 space-y-3">
        <h2 className="text-[15px] font-bold">판매 가이드</h2>
        <div className="grid grid-cols-3 gap-2">{([[Rocket, '첫 드롭\n등록하기', '등록부터\n승인까지 5단계'], [ScanSearch, '검수 기준 안내', '반려 없이 통과하는\n사진 · 상태'], [Truck, '출고 · 배송\n규칙', '결제 후 48시간\n내 출고']] as const).map(([Icon, title, desc]) => (
          <div key={title} className="rounded-[8px] bg-[var(--canvas)] p-3">
            <Icon size={18} strokeWidth={1.6}/>
            <p className="mt-3 whitespace-pre-line text-[13px] font-bold leading-snug">{title}</p>
            <p className="muted mt-1 whitespace-pre-line text-[11px] leading-snug">{desc}</p>
          </div>
        ))}</div>
      </section>
      <div className="mb-5 h-px bg-[var(--line)]"/>
      <section className="mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">판매자 자주 묻는 질문</h2>
          <button className="muted text-[12px]">전체보기</button>
        </div>
        {faqs.map(([, q], i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-[var(--line)] py-4">
            <div className="flex items-start gap-3">
              <span className="text-[14px] font-bold text-[var(--green)]">Q</span>
              <span className="text-[14px]">{q}</span>
            </div>
            <span className="shrink-0 muted text-[12px]">›</span>
          </div>
        ))}
      </section>
      <div className="mb-5 h-px bg-[var(--line)]"/>
      <section className="mb-5 space-y-3">
        <h2 className="text-[15px] font-bold">정책</h2>
        {[['판매자 이용약관', '/seller/terms'], ['판매 수수료 안내', '/seller/terms'], ['운영 정책 · 패널티 기준', '/seller/terms']].map(([label, to]) => (
          <Link key={label} to={to} className="divider flex h-[52px] items-center justify-between">
            <span className="text-[13px]">{label}</span>
            <span className="muted text-[12px]">{label === '판매 수수료 안내' ? '판매가의 9.8%' : ''}<ChevronRight size={16} className="inline muted ml-1"/></span>
          </Link>
        ))}
      </section>
      <div className="rounded-[8px] bg-[var(--canvas)] p-4 space-y-3">
        <p className="text-[14px] font-bold">원하는 답을 못 찾으셨나요?</p>
        <div className="flex gap-2">
          <Link to="/inquiries/compose" className="btn btn-outline flex-1 text-[12px]!">1:1 문의하기</Link>
          <Link to="/inquiries" className="btn btn-outline flex-1 text-[12px]!">내 문의 내역</Link>
        </div>
      </div>
    </div>
  );
}
export function InspectionFailPage() {
  const { id } = useParams(); const s = useStore(), user = activeUser(s), navigate = useNavigate(); const p = s.products.find(p => p.id === id && p.sellerId === user.id); if (!user.seller) return <Unavailable/>; if (!p) return <Empty title="상품을 찾을 수 없어요"><Link to="/seller" className="btn">판매자 홈</Link></Empty>;
  const CRITERIA = ['정품 여부', '상품 상태', '구성품', '수량'];
  // shortcut: 검수 결과 API 전이라 결과가 없으면 Figma 예시 결과를 보여 준다, 검수 API 연결 시 교체
  const result = ((p as any).inspectionResult ?? { '정품 여부': { pass: true, reason: '브랜드 정품 인증 확인' }, '상품 상태': { pass: false, reason: '등록 사진과 달리 외박스 모서리에 찍힘이 있어요' }, '구성품': { pass: false, reason: '설명서와 품질보증서가 빠져 있어요' }, '수량': { pass: true, reason: `옵션별 한정 수량 ${p.options.reduce((n, o) => n + o.stock, 0)}개 일치` } }) as Record<string, { pass: boolean; reason: string }>;
  const failCount = CRITERIA.filter(label => result?.[label] && !result[label].pass).length;
  return <div className="space-y-5">
    <div className="flex items-center justify-between pt-1">
      <h1 className="text-[18px] font-bold">판매 심사 결과</h1>
      <button onClick={() => navigate('/seller/products')} aria-label="닫기" className="p-1"><svg width="22" height="22" viewBox="0 0 22 22" fill="none"><path d="M17 5L5 17M5 5l12 12" stroke="#222" strokeWidth="1.8" strokeLinecap="round"/></svg></button>
    </div>
    <div className="relative overflow-hidden rounded-[8px]">
      <ProductImage src={p.images[0]} alt={p.name} className="h-[180px] w-full object-cover"/>
      <div className="absolute inset-0 flex flex-col items-center justify-end bg-black/65 pb-6 text-white">
        <div className="mb-3 flex h-[54px] w-[54px] items-center justify-center rounded-full border border-white/60"><svg width="24" height="24" viewBox="0 0 24 24" fill="none"><path d="M12 20v-8" stroke="white" strokeWidth="2" strokeLinecap="round"/><circle cx="12" cy="22" r="1" fill="white"/><path d="M20 15V13a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 13v6a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l1.3-.75" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/><path d="M2.3 13 12 19l9.7-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
        <p className="text-[20px] font-bold">물품 검수 미통과</p>
        <p className="mt-1 text-[13px] text-white/80">{p.brand} {p.name}</p>
      </div>
    </div>
    <div className="space-y-1">
      <h2 className="text-[22px] font-bold">물품 검수를</h2>
      <h2 className="text-[22px] font-bold">통과하지 못했어요</h2>
      <p className="mt-2 text-[13px] text-[#7B7B7B]">운영팀이 상품을 직접 확인한 결과예요.</p>
      <p className="text-[13px] text-[#7B7B7B]">입력한 정보는 저장돼 있으니 사유를 반영해 재등록해 주세요.</p>
    </div>
    <div className="rounded-[6px] border border-[var(--line)] p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">물품 검수 결과</h2>
        {failCount > 0 && <span className="rounded-[4px] bg-[#FDEFED] px-2 py-0.5 text-[11px] font-bold text-[#E5484D]">{failCount}개 항목 미통과</span>}
      </div>
      <p className="text-[13px] text-[#7B7B7B]">입고된 상품을 운영팀이 아래 4가지 기준으로 확인했어요.</p>
      <div className="rounded-[6px] bg-[#FBFBFB] divide-y divide-[var(--line)] px-4">
        {CRITERIA.map(label => {
          const r = result?.[label];
          const pass = !r || r.pass;
          return <div key={label} className="py-3 space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${pass ? 'border-[#3FB181]' : 'border-[#E5484D]'}`}>
                  {pass ? <Check size={11} className="text-[#3FB181]"/> : <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2l7 7M9 2L2 9" stroke="#E5484D" strokeWidth="1.5" strokeLinecap="round"/></svg>}
                </span>
                <span className="text-[13px] font-bold">{label}</span>
              </div>
              <span className={`text-[12px] font-bold ${pass ? 'text-[#949494]' : 'text-[#E5484D]'}`}>{pass ? '통과' : '미통과'}</span>
            </div>
            {r?.reason && <p className="pl-8 text-[12px] text-[#7B7B7B]">{r.reason}</p>}
          </div>;
        })}
      </div>
    </div>
    <Note title="운영팀 문의">검수 결과에 이의가 있으면 고객센터로 문의해 주세요.</Note>
    <div className="flex gap-2"><Button outline className="flex-1" onClick={() => navigate('/seller')}>판매자 홈</Button><Button className="flex-1" onClick={() => navigate(`/seller/new?edit=${p.id}`)}>재등록하기</Button></div>
  </div>;
}
export function TermsPage() {
  const navigate = useNavigate();
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const items: [string, string, boolean][] = [['terms', '판매자 이용약관', true], ['fee', '정산 및 판매 수수료 정책', true], ['operation', '한정 판매 운영 정책', true], ['privacy', '개인정보 수집·이용 동의', true], ['marketing', '판매 알림·혜택 정보 수신', false]];
  const allRequired = items.filter(([,, r]) => r).every(([k]) => checks[k]);
  const allChecked = items.every(([k]) => checks[k]);
  return <div className="space-y-5"><Header title="판매자 약관 동의"/><div className="space-y-2"><p className="text-[10px] font-bold tracking-[1px]">STOCKDROP PARTNERS</p><h1 className="text-[22px] font-bold leading-[1.5] tracking-[-1px]">심사 요청 전에<br/>판매자 약관을 확인해 주세요</h1><p className="muted text-[12px] leading-relaxed">한정 수량 선착순 판매는 구매자와의 약속이에요.<br/>운영 정책을 꼭 읽고 동의해 주세요.</p></div><label className="divider flex items-center gap-3 py-3 text-[14px] font-bold"><input type="checkbox" className="h-5 w-5" checked={allChecked} onChange={() => { const next = !allChecked; const obj: Record<string, boolean> = {}; items.forEach(([k]) => { obj[k] = next; }); setChecks(obj); }}/>전체 동의하기</label>{items.map(([key, label, required]) => <div key={key} className="divider flex items-center gap-2 py-3 text-[12px]"><label className="flex flex-1 items-center gap-3"><input type="checkbox" className="h-4 w-4 shrink-0" checked={checks[key] ?? false} onChange={e => setChecks({ ...checks, [key]: e.target.checked })}/><span>{required ? '필수' : '선택'} {'  '}{label}</span></label><Link to="/legal" className="muted shrink-0 text-[11px] underline">보기</Link></div>)}<Note title="한정 판매 운영 정책 요약"><p className="mb-2"><b>01</b> {'  '}판매가 시작되면 한정 수량과 가격을 변경할 수 없어요.</p><p className="mb-2"><b>02</b> {'  '}결제 완료 후 2영업일 이내에 출고해야 해요.</p><p><b>03</b> {'  '}출고 지연·품절 취소가 반복되면 판매가 제한될 수 있어요.</p></Note><Button className="w-full" disabled={!allRequired} onClick={() => navigate('/apply')}>동의하고 심사 요청하기</Button></div>;
}
