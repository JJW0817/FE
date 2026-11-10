import { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, Timer, X, Home, CalendarDays, Package, UserRound, LayoutDashboard, Shirt, MessageSquare, ClipboardList, ChevronRight, Info, Copy } from 'lucide-react';
import type { Product, Order } from '../domain';
import { money, saleState } from '../domain';
const ToastContext = createContext<(message: string) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState('');
  useEffect(() => { if (!message) return; const timer = setTimeout(() => setMessage(''), 4000); return () => clearTimeout(timer); }, [message]);
  return <ToastContext.Provider value={text => setMessage(text)}>{children}{message && <div role="status" className="fixed bottom-24 left-1/2 z-[100] w-[calc(100%-32px)] max-w-[358px] -translate-x-1/2 rounded-[6px] bg-[var(--ink)] px-4 py-3 text-center text-[12px] leading-relaxed text-[var(--surface)]">{message}</div>}</ToastContext.Provider>;
}
export const useToast = () => useContext(ToastContext);
export function Button({ children, outline, buy, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { outline?: boolean; buy?: boolean }) { return <button type="button" className={`btn ${outline ? 'btn-outline' : ''} ${buy ? 'btn-buy' : ''} ${className}`} {...props}>{children}</button>; }
export function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: ReactNode }) { return <div><span className="label">{label}{required && <span className="muted ml-1 text-[10px]">· 필수</span>}</span>{children}{hint && <p className="muted mt-2 text-[10px] leading-relaxed">{hint}</p>}</div>; }
export function Note({ title, children, green = false }: { title?: string; children: ReactNode; green?: boolean }) { return <div className={`note ${green ? 'bg-[var(--green-soft)]!' : ''}`}>{title && <h3 className="mb-1 font-bold">{title}</h3>}<div className="muted">{children}</div></div>; }
export function ErrorBox({ message }: { message: string }) { return message ? <div role="alert" className="rounded-[4px] bg-[var(--red-soft)] p-3 text-[12px] leading-relaxed text-[var(--red)]">{message}</div> : null; }
export function Empty({ title, message, children }: { title: string; message?: string; children?: ReactNode }) { return <div className="flex min-h-[260px] flex-col items-center justify-center gap-4 py-12 text-center"><Package size={32} className="muted" strokeWidth={1}/><h2 className="text-[16px] font-bold">{title}</h2>{message && <p className="muted max-w-[280px] text-[12px] leading-relaxed">{message}</p>}{children}</div>; }
export function Header({ title, subtitle, back = true, action, bare = false }: { title: string; subtitle?: string; back?: boolean; action?: ReactNode; bare?: boolean }) {
  const navigate = useNavigate();
  return <header className={bare ? 'mb-5 pb-3' : 'divider mb-5 pb-3'}><div className="flex min-h-[38px] items-center gap-3">{back && <button aria-label="이전 화면" onClick={() => window.history.state?.idx > 0 ? navigate(-1) : navigate('/')} className="-ml-1 grid h-9 w-9 shrink-0 place-items-center"><ArrowLeft size={20}/></button>}<h1 className="min-w-0 flex-1 text-[18px] font-bold tracking-[-.5px]">{title}</h1>{action}</div>{subtitle && <p className="muted mt-1 text-[11px] leading-relaxed">{subtitle}</p>}</header>;
}
export function Badge({ children, live = false, red = false }: { children: ReactNode; live?: boolean; red?: boolean }) { return <span className={`inline-flex w-fit items-center rounded-[3px] px-2 py-1 text-[10px] font-semibold ${live ? 'bg-[var(--green-soft)] text-[var(--green)]' : red ? 'bg-[var(--red-soft)] text-[var(--red)]' : 'bg-[var(--blue-soft)] text-[var(--ink)]'}`}>{children}</span>; }
export function InfoRow({ label, value, strong = false }: { label: string; value: ReactNode; strong?: boolean }) { return <div className="flex items-start justify-between gap-4 py-1"><span className="muted shrink-0 text-[12px]">{label}</span><span className={`min-w-0 text-right text-[12px] leading-relaxed ${strong ? 'font-bold' : ''}`}>{value}</span></div>; }
export function MenuRow({ label, to, children }: { label: string; to: string; children?: ReactNode }) { return <Link to={to} className="divider flex min-h-[52px] items-center gap-3"><span className="min-w-0 flex-1 text-[13px]">{label}</span>{children}<ChevronRight size={17} className="muted"/></Link>; }
export function ProductImage({ src, alt, className = '' }: { src: string; alt: string; className?: string }) { return <img src={typeof src === 'string' && src.startsWith('/images/') ? `.${src}` : src || './images/generated.png'} alt={alt} className={`block rounded-[4px] bg-[var(--blue-soft)] object-cover ${className}`} loading="lazy"/>; }
export function ProductSummary({ product, option, amount }: { product: { name: string; brand: string; image: string }; option?: ReactNode; amount?: number }) { return <div className="divider flex items-center gap-3 pb-4"><ProductImage src={product.image} alt={product.name} className="h-[86px] w-[76px] shrink-0"/><div className="min-w-0 flex-1 space-y-1.5"><p className="muted text-[10px]">{product.brand}</p><p className="text-[14px] font-semibold">{product.name}</p>{option && <div className="muted whitespace-pre-line text-[11px] leading-relaxed">{option}</div>}{amount !== undefined && <p className="font-number text-[14px] font-bold">{money(amount)}</p>}</div></div>; }
/** 판매 시작 알림 신청 목록 (Notification 연동 전 로컬 저장) */
const NOTIFY_KEY = 'stockdrop:notified-products';
export function readNotified(): string[] { try { const v = JSON.parse(localStorage.getItem(NOTIFY_KEY) || 'null'); return Array.isArray(v) ? v : ['basket']; } catch { return []; } }
export function useNotified() {
  const [ids, setIds] = useState<string[]>(readNotified);
  const toggle = (id: string) => setIds(prev => { const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]; try { localStorage.setItem(NOTIFY_KEY, JSON.stringify(next)); } catch { /* 저장 차단 시 화면 상태만 유지 */ } return next; });
  return [ids, toggle] as const;
}
const pad = (n: number) => String(n).padStart(2, '0');
export const clockLeft = (ms: number) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s % 3600 / 60))}:${pad(s % 60)}`; };
export const openLabel = (t: number, now: number) => { const d = new Date(t), n = new Date(now); const same = d.toDateString() === n.toDateString(); return `${same ? '오늘' : `${d.getMonth() + 1}월 ${d.getDate()}일`} ${pad(d.getHours())}:${pad(d.getMinutes())} 오픈`; };
export const soldOutLabel = (p: Product) => { if (!p.soldOutAt) return '판매 종료'; const m = Math.max(1, Math.round((p.soldOutAt - p.startsAt) / 60_000)); return `${m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`} 만에 완판됐어요`; };
export function ProductCard({ product: p, now, availableCount, notified, onNotify }: { product: Product; now: number; availableCount?: number; notified?: boolean; onNotify?: () => void }) {
  const status = saleState(p, now);
  const total = p.options.reduce((n, o) => n + o.stock, 0), left = availableCount ?? total;
  const soldOut = (status === '판매 중' && availableCount === 0) || (status === '판매 종료' && !!p.soldOutAt);
  const urgent = status === '판매 중' && !soldOut && p.endsAt - now <= 3_600_000;
  const pct = total ? Math.min(100, Math.max(0, (1 - left / total) * 100)) : 0;
  return <Link to={`/product/${p.id}`} className="block min-w-0">
    <div className="relative">
      <ProductImage src={p.images[0]} alt={p.name} className={`aspect-square w-full ${soldOut ? 'opacity-50' : ''}`}/>
      {status === '판매 중' && !soldOut && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-[4px] bg-black/75 px-1.5 py-1 text-[11px] font-bold tabular-nums text-white"><Timer size={12}/>{clockLeft(p.endsAt - now)}</span>}
      {status === '판매 예정' && <span className="absolute left-2 top-2 flex items-center gap-1 rounded-[4px] bg-black/75 px-1.5 py-1 text-[11px] font-bold text-white"><Bell size={12}/>{openLabel(p.startsAt, now)}</span>}
      {urgent && <span className="absolute bottom-2 left-2 rounded-[4px] bg-[var(--urgent)] px-1.5 py-1 text-[11px] font-bold text-white">마감 임박</span>}
      {soldOut && <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-[4px] bg-[#333333] px-3 py-1.5 text-[12px] font-bold text-white">SOLD OUT</span>}
    </div>
    <p className="mt-2.5 text-[11px] font-bold text-[var(--aux)]">{p.brand}</p>
    <h3 className={`mt-0.5 text-[14px] ${soldOut ? 'text-[var(--meta)]' : ''}`}>{p.name}</h3>
    <p className={`mt-0.5 text-[16px] font-bold ${soldOut ? 'text-[var(--meta)]' : ''}`}>{money(p.price)}</p>
    {status === '판매 중' && !soldOut && <><div className="mt-2 h-1 w-full rounded-full bg-[var(--line)]"><div className={`h-1 rounded-full ${urgent ? 'bg-[var(--urgent)]' : 'bg-[var(--ink)]'}`} style={{ width: `${pct}%` }}/></div><p className={`mt-1.5 text-[12px] ${urgent ? 'font-bold text-[var(--urgent)]' : 'text-[var(--aux)]'}`}>{urgent ? `서두르세요! ${left}개 남음` : `${total}개 중 ${left}개 남음`}</p></>}
    {status === '판매 예정' && <><p className="mt-2 text-[12px] text-[var(--aux)]">{total}개 한정 · 1인 {p.maxPerAccount}개</p>{onNotify && <button type="button" onClick={e => { e.preventDefault(); onNotify(); }} className={`mt-2 flex h-8 w-full items-center justify-center gap-1 rounded-[4px] text-[12px] font-bold ${notified ? 'bg-[var(--ink)] text-white' : 'border border-[var(--border)]'}`}><Bell size={13}/>{notified ? '알림 설정됨' : '오픈 알림 받기'}</button>}</>}
    {soldOut && <p className="mt-2 text-[12px] text-[var(--aux)]">{soldOutLabel(p)}</p>}
    {status === '판매 종료' && !soldOut && <p className="mt-2 text-[12px] text-[var(--aux)]">판매 종료</p>}
  </Link>;
}
export function Progress({ step }: { step: number }) { return <div aria-label={`상품 등록 ${step} / 7단계`} className="mb-5 flex gap-[5px]">{Array.from({ length: 7 }, (_, i) => <div key={i} className={`h-1 flex-1 rounded-[2px] ${i < step ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'}`}/>)}</div>; }
export const ORDER_LABELS: Record<Order['status'], string> = { paid: '결제 완료', preparing: '배송 준비', shipping: '배송 중', delivered: '배송 완료', cancelled: '취소 완료', refunded: '환불 완료' };
export function DeliveryProgress({ status }: { status: Order['status'] }) { const active = ['paid', 'preparing', 'shipping', 'delivered'].indexOf(status); return <div className="divider grid grid-cols-4 gap-1 pb-5">{['결제 완료', '배송 준비', '배송 중', '배송 완료'].map((label, i) => <div key={label} className="flex flex-col items-center gap-2"><span className={`font-number grid h-[30px] w-[30px] place-items-center rounded-full text-[11px] ${i <= active ? 'bg-[var(--ink)] text-[var(--surface)]' : 'bg-[var(--blue-soft)] text-[var(--muted)]'}`}>{i < active ? '✓' : i + 1}</span><span className={`text-[10px] ${i === active ? 'font-bold' : 'muted'}`}>{label}</span></div>)}</div>; }
export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const node = ref.current!; node.showModal(); const alreadyLocked = document.body.classList.contains('overflow-hidden'); document.body.classList.add('overflow-hidden'); return () => { node.close(); if (!alreadyLocked) document.body.classList.remove('overflow-hidden'); }; }, []);
  return <dialog ref={ref} aria-label={title} onCancel={event => { event.preventDefault(); onClose(); }} onClick={event => { if (event.target === event.currentTarget) onClose(); }} className="fixed inset-x-0 bottom-0 top-auto m-0 mx-auto max-h-[92dvh] w-full max-w-[390px] overflow-y-auto rounded-t-[16px] border-0 bg-[var(--surface)] p-5 text-[var(--ink)] backdrop:bg-[var(--overlay)]"><div className="mx-auto mb-5 h-1 w-9 rounded-full bg-[var(--line)]"/><div className="mb-5 flex items-center justify-between gap-4"><h2 className="text-[18px] font-bold">{title}</h2><button aria-label="닫기" onClick={onClose} className="grid h-9 w-9 shrink-0 place-items-center"><X size={20}/></button></div>{children}</dialog>;
}
export function BottomNav({ mode }: { mode: 'buyer' | 'seller' }) {
  const items = mode === 'seller' ? [['/seller', '운영', LayoutDashboard], ['/seller/products', '상품 관리', Shirt], ['/seller/inquiries', '문의', MessageSquare], ['/seller/orders', '주문', ClipboardList], ['/seller/my', '마이', UserRound]] as const : [['/', '홈', Home], ['/schedule', '판매 일정', CalendarDays], ['/orders', '주문', Package], ['/my', '마이', UserRound]] as const;
  return <nav aria-label={mode === 'buyer' ? '구매자 하단 메뉴' : '판매자 하단 메뉴'} className="fixed bottom-0 left-1/2 z-30 w-full max-w-[390px] -translate-x-1/2 border-t border-[var(--line)] bg-[var(--surface)] px-1 pb-[max(14px,env(safe-area-inset-bottom))] pt-2"><div className="flex">{items.map(([to, label, Icon]) => <NavLink end key={to} to={to} className={({ isActive }) => `flex min-h-11 flex-1 flex-col items-center justify-center gap-1 text-[9px] ${isActive ? 'font-bold text-[var(--ink)]' : 'text-[var(--muted)]'}`}><Icon size={20} strokeWidth={1.5}/>{label}</NavLink>)}</div></nav>;
}
export async function copyText(text: string) { if (!navigator.clipboard) throw new Error('클립보드를 사용할 수 없습니다. 번호를 길게 눌러 복사해 주세요.'); await navigator.clipboard.writeText(text); }
export function CopyButton({ value }: { value: string }) { const toast = useToast(); return <button aria-label="복사" className="grid h-8 w-8 place-items-center" onClick={() => copyText(value).then(() => toast('복사했습니다.')).catch(e => toast(e.message))}><Copy size={16} className="muted"/></button>; }
export function Unavailable({ message = '접근할 수 없는 화면입니다.' }: { message?: string }) { return <><Header title="접근 안내"/><Empty title={message} message="이 화면을 사용할 수 있는 계정으로 전환해 주세요."><Link to="/my" className="btn">마이페이지로</Link></Empty></>; }
export function Loading({ text = '확인하고 있어요…' }: { text?: string }) { return <div className="muted flex items-center justify-center gap-2 py-10 text-[12px]"><Info size={16}/>{text}</div>; }

/** 바텀시트 — 상단 모서리 16, 손잡이, 뒤 배경 45% 어둡게 */
export function BottomSheet({ title, children, onClose }: { title?: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'var(--overlay)' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="w-full max-w-[390px] rounded-t-[16px] bg-[var(--surface)] pb-safe" style={{ animation: 'sheet-in 240ms cubic-bezier(.22,1,.36,1) both' }}>
        <div className="flex justify-center py-3"><div className="h-1 w-9 rounded-full bg-[var(--border)]"/></div>
        {title && <div className="flex items-center justify-between border-b border-[var(--line)] px-4 pb-3"><h2 className="text-[16px] font-bold">{title}</h2><button aria-label="닫기" onClick={onClose}><X size={20} className="muted"/></button></div>}
        <div className="px-4 pb-6 pt-4">{children}</div>
      </div>
    </div>
  );
}

/** 수량 증감 — 계정당 최대 수 적용 */
export function QuantityStepper({ value, min = 0, max, onChange }: { value: number; min?: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="inline-flex items-center gap-3">
      <button aria-label="수량 감소" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] text-[18px] font-bold disabled:opacity-30">−</button>
      <span className="font-number w-6 text-center text-[15px] font-bold">{value}</span>
      <button aria-label="수량 증가" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="grid h-8 w-8 place-items-center rounded-full border border-[var(--border)] text-[18px] font-bold disabled:opacity-30">+</button>
    </div>
  );
}

/** 칩 — 선택 시 ink 바탕 흰 글자, 기본 흰 바탕 border */
export function Chip({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`inline-flex h-8 items-center rounded-full px-3.5 text-[12px] font-medium transition-colors ${selected ? 'bg-[var(--ink)] text-[var(--surface)]' : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink)]'}`}>
      {children}
    </button>
  );
}

/** 작성 중 나가기 확인 대화상자 */
export function ConfirmLeave({ onLeave, onStay }: { onLeave: () => void; onStay: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'var(--overlay)' }}>
      <div className="w-[318px] rounded-[8px] bg-[var(--surface)] p-6 space-y-4">
        <h2 className="text-[16px] font-bold">작성을 그만할까요?</h2>
        <p className="muted text-[13px] leading-relaxed">지금 나가면 입력한 내용이 저장되지 않아요.</p>
        <div className="flex gap-2">
          <Button outline className="flex-1" onClick={onLeave}>나가기</Button>
          <Button className="flex-1" onClick={onStay}>계속 작성</Button>
        </div>
      </div>
    </div>
  );
}

/** 처리 실패와 재시도 — 입력 내용 유지 (Figma: 가운데 대화상자, 뒤 화면 어둡게) */
export function RetryError({ message, onRetry, onBack }: { message: string; onRetry: () => void; onBack?: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'var(--overlay)' }}>
      <div className="w-[318px] rounded-[8px] bg-[var(--surface)] p-6 space-y-4">
        <h2 className="text-[16px] font-bold">요청을 처리하지 못했어요</h2>
        <p className="muted text-[13px] leading-relaxed">{message || '일시적인 오류로 문의가 접수되지 않았어요. 입력한 내용은 그대로 남아 있어요.'}</p>
        <div className="flex gap-2">
          {onBack && <Button outline className="flex-1" onClick={onBack}>이전으로</Button>}
          <Button className="flex-1" onClick={onRetry}>다시 시도</Button>
        </div>
      </div>
    </div>
  );
}

/** 로그인 필요 대화상자 — 로그인 후 returnTo로 복귀 */
export function LoginRequired({ returnTo, onClose }: { returnTo: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: 'var(--overlay)' }}>
      <div className="w-[318px] rounded-[8px] bg-[var(--surface)] p-6 space-y-4">
        <h2 className="text-[16px] font-bold">로그인이 필요해요</h2>
        <p className="muted text-[13px] leading-relaxed">로그인하면 보고 있던 상품으로 바로 돌아와요.</p>
        <div className="space-y-2">
          <Link to={`/login?next=${encodeURIComponent(returnTo)}`} className="btn w-full">로그인</Link>
          <Link to={`/signup?next=${encodeURIComponent(returnTo)}`} className="btn btn-outline w-full">이메일로 회원가입</Link>
          <button onClick={onClose} className="muted w-full py-2 text-[12px]">닫기</button>
        </div>
      </div>
    </div>
  );
}

/** 토글 스위치 — 48×28, 켜짐 #222222 */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-label={label} aria-checked={checked} onClick={() => onChange(!checked)} className={`relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors ${checked ? 'bg-[var(--ink)]' : 'bg-[var(--border)]'}`}><span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-all ${checked ? 'left-[23px]' : 'left-[3px]'}`}/></button>;
}
