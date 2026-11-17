import { useEffect, useState } from 'react';
import { errorMessage } from '../api';
import { pushDiagnostics, resubscribePush, type PushDiagnostics } from '../push';

const RESULT: Record<string, string> = { granted: '등록 완료', denied: '권한 거부됨', default: '권한 팝업이 뜨지 않음', disabled: '서버 푸시 꺼짐(push-configuration)', unsupported: '홈 화면 앱(iOS)이 아님' };

/** 미리보기·개발 환경 전용 푸시 상태 점검(PUSH_DEBUG). 서버 테스트 발송 API는 명세에 없어 버튼을 두지 않는다 */
export function PushDebug() {
  const [d, setD] = useState<PushDiagnostics | null>(null), [busy, setBusy] = useState(false), [msg, setMsg] = useState('');
  const load = () => pushDiagnostics().then(setD).catch(e => setMsg(errorMessage(e)));
  useEffect(() => { void load(); }, []);
  const rows: [string, string][] = d ? [
    ['홈 화면 앱(standalone)', d.standalone ? '예' : '아니요'], ['iOS', d.ios ? '예' : '아니요'], ['알림 권한', d.permission],
    ['서비스 워커', d.sw], ['브라우저 구독', d.subscription],
    ['서버 등록', d.last ? `${new Date(d.last.at).toLocaleString('ko-KR')} · ${d.last.ok ? '성공' : `실패 ${d.last.message ?? ''}`}` : '기록 없음'],
  ] : [];
  return <section className="space-y-2 rounded-[6px] border border-dashed border-[var(--line)] p-4 text-[12px]" aria-label="푸시 상태 점검">
    <p className="font-bold">푸시 상태 점검 (미리보기 전용)</p>
    {rows.map(([k, v]) => <div key={k} className="flex gap-3"><span className="muted w-[110px] shrink-0">{k}</span><span className="break-all">{v}</span></div>)}
    {msg && <p className="text-[var(--red)]">{msg}</p>}
    <div className="flex gap-2 pt-1">
      <button type="button" className="rounded-[4px] border border-[var(--ink)] px-3 py-2 font-bold" disabled={busy} onClick={async () => { setBusy(true); setMsg(''); try { setMsg(RESULT[await resubscribePush()] ?? '완료'); } catch (e) { setMsg(`실패: ${errorMessage(e)}`); } finally { setBusy(false); void load(); } }}>{busy ? '등록 중…' : '구독 다시 등록'}</button>
      <button type="button" className="muted rounded-[4px] border border-[var(--line)] px-3 py-2" onClick={() => void load()}>새로 고침</button>
    </div>
    <p className="muted text-[11px]">테스트 알림 발송 API는 명세에 없어요. 실제 알림(예: 관심 상품 판매 시작)으로 확인해 주세요.</p>
  </section>;
}
