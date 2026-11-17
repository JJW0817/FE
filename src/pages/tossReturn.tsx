import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { mergeCheckout } from '../api';
import { defaultTossDeps, hasTossParams, orderIdOfToss, processTossSuccess, readTossParams, readTossPending, readTossReturn, rememberTossPending, stashTossReturn, tossFailure, TOSS_RETURN_PATH } from '../api/tossReturn';
import type { TossOutcome, TossReturn } from '../api/tossReturn';
import { errorMessage } from '../api/errors';
import { loginHref, signedIn } from '../auth';
import { Empty, ErrorBox, Header } from '../components/ui';
import { mutate, useStore } from '../store';
import { USE_MOCK } from '../config';

/**
 * 토스 결제창에서 돌아오는 화면(#/payments/toss/success · fail).
 * 1) 쿼리(해시 앞·안)를 읽어 보관하고 주소에서 지운다(새로고침·뒤로 가기에 다시 처리되지 않게)
 * 2) 로그인이 안 돼 있으면(아이폰 홈 화면 앱 → 사파리로 열린 경우 등) 로그인 후 이 화면으로 돌아와 이어서 처리
 * 3) 성공: 승인 요청(한 번만) → 확정까지 확인 → 결제 완료 / 실패 / 지연. 실패: 토스 code·message로 결제 실패 화면
 */
/** 성공·실패 주소가 바뀌면 새로 처리한다(같은 문서 안에서 해시만 바뀌어도) */
export function TossReturnPage() { const { result } = useParams(); return <TossReturnView key={result} result={result}/>; }
function TossReturnView({ result }: { result?: string }) {
  const navigate = useNavigate(); const s = useStore();
  const [ret] = useState<TossReturn | null>(() => {
    const p = readTossParams(window.location);
    if (hasTossParams(p)) { const r: TossReturn = { ...p, result: result === 'fail' ? 'fail' : 'success' }; stashTossReturn(r); return r; }
    return readTossReturn(); // 쿼리를 지운 뒤 새로고침했거나 로그인하고 돌아왔다
  });
  // 주소의 paymentKey 등을 지운다(해시 앞 쿼리 포함)
  useEffect(() => { const path = ret ? TOSS_RETURN_PATH[ret.result] : TOSS_RETURN_PATH.success; if (window.location.search || window.location.hash.includes('?')) history.replaceState(history.state, '', `${window.location.pathname}#${path}`); }, []);
  const [outcome, setOutcome] = useState<TossOutcome | null>(null), [error, setError] = useState(''); const started = useRef(false);
  const logged = signedIn(s);
  useEffect(() => {
    if (USE_MOCK || !ret || started.current) return;
    if (!logged) { navigate(loginHref(TOSS_RETURN_PATH[ret.result]), { replace: true }); return; } // 보관한 값으로 로그인 뒤 이어서
    started.current = true;
    const run = ret.result === 'fail' ? Promise.resolve(tossFailure(readTossPending()?.orderId ?? (ret.orderId ? orderIdOfToss(ret.orderId) : ''), ret.code, ret.message))
      : processTossSuccess(ret, readTossPending(), { ...defaultTossDeps(), onUpdate: d => mutate(st => mergeCheckout(st, d)) });
    run.then(o => { setOutcome(o); if (o.kind !== 'delayed') { stashTossReturn(null); rememberTossPending(null); } }).catch(e => setError(errorMessage(e)));
  }, [ret, logged]);
  // 결과 화면으로: 확정 → 결제 완료(Figma), 실패 → 결제 실패와 취소(Figma, 결제 화면이 보여 준다)
  useEffect(() => {
    if (!outcome) return;
    if (outcome.kind === 'confirmed') navigate(`/orders/${outcome.checkout.orderId}?complete=1`, { replace: true });
    else if (outcome.kind === 'failed' && outcome.orderId) navigate(`/checkout/${outcome.orderId}`, { replace: true, state: outcome.checkout && ['FAILED', 'EXPIRED'].includes(outcome.checkout.state) ? null : { payFailure: { code: outcome.code, message: outcome.message } } });
  }, [outcome]);
  if (USE_MOCK || !ret) return <Empty title="처리할 결제가 없어요" message="주문 내역에서 결제 상태를 확인해 주세요."><Link className="btn" to="/orders">주문 내역</Link></Empty>;
  if (error) return <div className="space-y-4"><Header title="결제 확인"/><ErrorBox message={error}/><Link className="btn w-full" to="/orders">주문 내역</Link></div>;
  if (outcome?.kind === 'delayed') return <div className="space-y-4"><Header title="결제 확인"/><h2 className="text-[20px] font-bold">결제 확인이 늦어지고 있어요</h2><p className="muted text-[13px] leading-relaxed">주문 내역에서 확인해 주세요. 결제가 확정되면 주문 내역에 바로 보여요.</p><Link className="btn w-full" to="/orders">주문 내역</Link></div>;
  if (outcome?.kind === 'failed' && !outcome.orderId) return <div className="space-y-4"><Header title="결제 확인"/><h2 className="text-[20px] font-bold">결제가 완료되지 않았어요</h2><p className="muted text-[13px]">{outcome.message ?? outcome.code}</p><Link className="btn w-full" to="/orders">주문 내역</Link></div>;
  return <div role="status" aria-live="polite" className="flex min-h-[60dvh] flex-col items-center justify-center gap-3 text-center"><Loader2 size={28} className="animate-spin"/><h1 className="text-[18px] font-bold">결제를 확정하고 있어요</h1><p className="muted text-[12px]">창을 닫지 말고 잠시만 기다려 주세요.</p></div>;
}
