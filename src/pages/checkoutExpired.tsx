import { Link } from 'react-router-dom';
import { Button, Header, InfoRow, ProductSummary } from '../components/ui';
import type { Hold, Product } from '../domain';

/** 한국 시간(HH:mm:ss) — 기기 시간대와 상관없이 KST로 보여 준다 */
export const kstTime = (t: number) => new Date(t).toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });

/**
 * 결제 시간 만료 화면 — Figma "결제 시간 만료". 만료되면 결제 화면(배송지·금액·약관·결제 버튼)을 통째로 이 화면으로 바꾼다.
 * remaining: 서버가 준 남은 수량(없으면 그 줄을 숨긴다). 다시 구매하기는 만료된 주문을 열지 않고 새 주문을 시작한다(onRebuy).
 */
export function ExpiredCheckout({ hold, product: p, remaining, busy, error, onRebuy }: { hold: Hold; product: Product; remaining?: number; busy: boolean; error: string; onRebuy: () => void }) {
  return <div className="space-y-5 pb-24">
    <Header title="주문 / 결제" subtitle="결제 시간이 만료되어 확보한 재고가 해제됐어요"/>
    <div className="rounded-[6px] bg-[var(--ink)] p-4 text-[var(--surface)]">
      <div className="mb-2 flex items-center justify-between"><p className="text-[11px] opacity-70">선착순 재고 확보 시간 종료</p><span className="rounded-full bg-[var(--red)] px-2 py-0.5 text-[11px] font-bold text-white">시간 만료</span></div>
      <p className="font-number text-[40px] font-bold opacity-40">00:00</p>
      <p className="mt-2 text-[11px] opacity-70">5분 안에 결제되지 않아 재고가 다음 구매자에게 넘어갔어요.</p>
    </div>
    <h2 className="text-[22px] font-bold">결제 시간이 지나<br/>주문이 취소됐어요</h2>
    <p className="muted text-[13px] leading-relaxed">결제는 진행되지 않았어요. 남은 수량이 있으면<br/>다시 구매를 시작해 결제 시간을 확보할 수 있어요.</p>
    <div className="relative">
      <div className="opacity-60"><ProductSummary product={{ ...p, image: p.images[0] }} option={hold.lines.map(l => `${l.name} / ${l.quantity}개`).join('\n')} amount={hold.lines.reduce((n, l) => n + l.quantity * p.price, 0)}/></div>
      <span className="absolute right-0 top-0 rounded-[4px] bg-[var(--soft)] px-2 py-1 text-[11px] font-bold text-[var(--aux)]">재고 해제</span>
    </div>
    <div className="space-y-2">
      <InfoRow label="재고 확보" value={kstTime(hold.createdAt)} strong/>
      <InfoRow label="결제 만료" value={<span className="text-[var(--red)]">{kstTime(hold.expiresAt)}</span>} strong/>
      {remaining !== undefined && <InfoRow label="남은 수량" value={`${remaining}개`} strong/>}
    </div>
    <div className="rounded-[6px] bg-[var(--soft)] p-4"><p className="muted text-[12px] leading-relaxed">결제가 승인되지 않아 금액이 빠져나가지 않아요.<br/>입력한 배송지는 다음 주문에 그대로 쓸 수 있어요.</p></div>
    {error && <p role="alert" className="text-[12px] text-[var(--red)]">{error}</p>}
    <div className="fixed inset-x-0 bottom-0 z-20 mx-auto flex w-full max-w-[390px] gap-2 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3">
      <Link className="btn btn-outline flex-1" to="/">홈으로</Link>
      <Button className="flex-1" disabled={busy} onClick={onRebuy}>{busy ? '재고 확보 중…' : '다시 구매하기'}</Button>
    </div>
  </div>;
}
