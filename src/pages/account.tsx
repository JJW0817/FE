import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ArrowLeft, Building2, CalendarCheck, Check, Store, UserRound, CheckCircle2, FileText } from 'lucide-react';
import { activeUser, approveApplication, money, nowOf, saleState, uid } from '../domain';
import type { Address, Application, DocumentFile } from '../domain';
import { atomic, mutate, useStore } from '../store';
import { dateTime } from '../hooks';
import { Badge, Button, Chip, ConfirmLeave, Empty, ErrorBox, Field, Header, InfoRow, MenuRow, Modal, Note, ProductImage, Unavailable, useToast } from '../components/ui';
import { PdfField } from '../components/PdfField';
import { deleteAddress, listAddresses, setDefaultAddress, takeAddressPick, toAddress } from './address';
import type { SavedAddress as ApiAddr } from './address';
import { LogoutButton } from './auth';
import { changePassword, restoreSession, validPassword } from '../auth';
import { apiGet, apiPost, apiPut, apiPatch, apiDelete, apiPostForm } from '../api';
import { getPdf } from '../files';
function ProfileEditModal({ userId, name: initialName, phone: initialPhone, onClose }: { userId: string; name: string; phone: string; onClose: () => void }) {
  const [name, setName] = useState(initialName), [phone, setPhone] = useState(initialPhone), [error, setError] = useState(''), [busy, setBusy] = useState(false); const toast = useToast();
  return <Modal title="내 정보 수정" onClose={onClose}><form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (!name.trim()) { setError('이름을 입력해 주세요.'); return; } setBusy(true); setError(''); try { await apiPatch('/accounts/me', { name: name.trim(), phone: phone.trim() }); mutate(s => { const u = s.users.find(u => u.id === userId); if (u) { u.name = name.trim(); u.phone = phone.trim(); } }); toast('정보를 수정했습니다.'); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><Field label="이름" required><input aria-label="이름" className="field" value={name} onChange={e => setName(e.target.value)} required/></Field><Field label="연락처"><input aria-label="연락처" className="field" value={phone} onChange={e => setPhone(e.target.value)} type="tel"/></Field><p className="muted text-[11px]">이메일은 변경할 수 없습니다.</p><ErrorBox message={error}/><Button type="submit" className="w-full" disabled={busy}>{busy ? '저장 중…' : '저장하기'}</Button></form></Modal>;
}
function PasswordChangeModal({ onClose }: { onClose: () => void }) {
  const [current, setCurrent] = useState(''), [next, setNext] = useState(''), [confirm, setConfirm] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false); const toast = useToast();
  return <Modal title="비밀번호 변경" onClose={onClose}><form className="space-y-4" onSubmit={async e => { e.preventDefault(); if (next !== confirm) { setError('새 비밀번호가 일치하지 않습니다.'); return; } setBusy(true); setError(''); try { await changePassword(current, next); toast('비밀번호를 변경했습니다.'); onClose(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><Field label="현재 비밀번호" required><input type="password" aria-label="현재 비밀번호" className="field" value={current} onChange={e => setCurrent(e.target.value)} required autoComplete="current-password"/></Field><Field label="새 비밀번호" required><input type="password" aria-label="새 비밀번호" className="field" value={next} onChange={e => setNext(e.target.value)} required autoComplete="new-password" placeholder="영문·숫자·특수문자 8~32자"/></Field><Field label="새 비밀번호 확인" required><input type="password" aria-label="새 비밀번호 확인" className="field" value={confirm} onChange={e => setConfirm(e.target.value)} required autoComplete="new-password"/></Field>{confirm && confirm !== next && <p className="text-[11px] text-[var(--red)]">비밀번호가 일치하지 않아요.</p>}<ErrorBox message={error}/><Button type="submit" className="w-full" disabled={busy || !current || !next || next !== confirm || !validPassword(next)}>{busy ? '변경 중…' : '변경하기'}</Button></form></Modal>;
}
export function MyPage() {
  const s = useStore(), user = activeUser(s), navigate = useNavigate(); const app = s.applications.find(a => a.userId === user.id); const [address, setAddress] = useState(false); const [profileEdit, setProfileEdit] = useState(false); const [pwChange, setPwChange] = useState(false); const toast = useToast();
  const roleLabel = user.seller ? '판매자 모드로 전환' : app?.status === 'pending' ? '심사 현황 보기' : app?.status === 'rejected' ? '심사 결과 확인하기' : '판매자 입점 신청';
  const shortTs = (ms: number) => { const d = new Date(ms); return `${d.getMonth()+1}.${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; };
  const shortDt = (ms: number) => { const d = new Date(ms); const days = ['일','월','화','수','목','금','토']; return `${d.getMonth()+1}.${d.getDate()} (${days[d.getDay()]})`; };
  const reviewDate = app ? (app.reviewedAt ?? (app.submittedAt + 2 * 86_400_000)) : 0;
  const deadlineDate = app ? (app.deadlineAt ?? (app.submittedAt + 7 * 86_400_000)) : 0;
  const appStatusDesc = app?.status === 'pending'
    ? `${shortTs(app.submittedAt)} 신청 · ${shortDt(reviewDate)} 결과 안내 예정`
    : app?.status === 'approved'
    ? `${shortTs(app.approvedAt ?? app.submittedAt)} 승인 · 지금 첫 한정 판매를 등록할 수 있어요`
    : app?.status === 'rejected'
    ? `${(app.rejectionItems?.length ?? 0)}개 항목 보완 필요 · ${shortDt(deadlineDate)}까지 제출해 주세요`
    : '';
  const appStepLabel = app?.status === 'pending' ? '심사 중' : app?.status === 'approved' ? '승인 완료' : app?.status === 'rejected' ? '거절' : '';
  return <div className="space-y-5"><Header title="구매자 마이페이지" subtitle="내 주문과 계정 정보를 관리하세요." back={false}/><button className="divider w-full flex items-center gap-3 pb-5 text-left" onClick={() => setProfileEdit(true)}><div className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-[4px] bg-[var(--blue-soft)] text-[18px] font-bold">{user.name[0]}</div><div className="min-w-0 flex-1"><h2 className="break-words text-[17px] font-bold">{user.name}</h2><p className="muted mt-1 break-all text-[12px]">{user.email}</p></div><span className="muted text-[11px] shrink-0">수정 ›</span></button><MenuRow to="/orders" label="주문 · 배송 조회"/><section className="note space-y-3"><p className="muted text-[10px]">회원 권한</p><h2 className="text-[22px] font-bold">구매자{user.seller ? ' + 판매자' : ''}</h2><p className="muted text-[12px]">{user.seller ? '개인·사업자 모두 구매할 수 있어요.' : '개인·사업자 모두 구매할 수 있어요.'}</p><p className="muted text-[12px]">판매는 입점 심사 승인 후 시작할 수 있어요.</p>{app && <div className="rounded-[4px] bg-[var(--canvas,#F7F7F7)] p-3 space-y-1"><div className="flex items-center justify-between"><p className="text-[11px] font-bold">판매자 입점 신청</p><span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${app.status === 'approved' ? 'bg-[var(--green-soft)] text-[var(--green)]' : app.status === 'rejected' ? 'bg-[var(--red-soft,#FEF2F2)] text-[var(--red)]' : 'bg-[var(--blue-soft)]'}`}>{appStepLabel}</span></div><p className="muted text-[11px] leading-relaxed">{appStatusDesc}</p></div>}<Button className="w-full" onClick={() => { if (user.seller) { mutate(state => { state.mode = 'seller'; }); navigate('/seller'); } else if (app) navigate('/apply'); else navigate('/seller/terms'); }}>{roleLabel}</Button></section><div><button onClick={() => navigate('/addresses')} className="divider flex h-[52px] w-full items-center justify-between"><span>배송지 관리</span><span className="muted">›</span></button><button onClick={() => navigate('/notifications/settings')} className="divider flex h-[52px] w-full items-center justify-between"><span>알림 설정</span><span className="muted">›</span></button><button onClick={() => setPwChange(true)} className="divider flex h-[52px] w-full items-center justify-between"><span>비밀번호 변경</span><span className="muted">›</span></button><Link className="divider flex h-[52px] items-center justify-between" to="/support">고객 지원 <span className="muted">›</span></Link></div>{user.admin && <MenuRow to="/admin" label="운영자 · 판매자 신청 검토"/>}<LogoutButton/>{profileEdit && <ProfileEditModal userId={user.id} name={user.name} phone={user.phone} onClose={() => setProfileEdit(false)}/>}{pwChange && <PasswordChangeModal onClose={() => setPwChange(false)}/>}</div>;
}

interface ApplicationForm { displayName: string; name: string; email: string; phone: string; bank: string; account: string; shippingPostal: string; shippingAddress: string; returnPostal: string; returnAddress: string }
export function ApplicationPage() {
  const s = useStore(), user = activeUser(s), navigate = useNavigate(); const previous = s.applications.find(a => a.userId === user.id); const toast = useToast();
  const [showDetail, setShowDetail] = useState(false);
  const [doc, setDoc] = useState<DocumentFile | undefined>(() => { try { return JSON.parse(localStorage.getItem(`application-doc:${user.id}`) || 'null') ?? undefined; } catch { return undefined; } }); const [form, setForm] = useState<ApplicationForm>(() => { try { return JSON.parse(localStorage.getItem(`application-draft:${user.id}`) || 'null') ?? { displayName: '', name: user.name, email: user.email, phone: user.phone, bank: '신한은행', account: '', shippingPostal: '', shippingAddress: '', returnPostal: '', returnAddress: '' }; } catch { return { displayName: '', name: user.name, email: user.email, phone: user.phone, bank: '신한은행', account: '', shippingPostal: '', shippingAddress: '', returnPostal: '', returnAddress: '' }; } }); const [error, setError] = useState('');
  // 주소 검색(Daum) 결과로 출고지·반품 주소와 우편번호를 채운다
  const [applyParams, setApplyParams] = useSearchParams();
  useEffect(() => { const target = applyParams.get('pick'); if (!target) return; const picked = takeAddressPick(); if (picked) setForm(f => { const next = target === 'shipping' ? { ...f, shippingAddress: picked.roadAddress, shippingPostal: picked.postalCode } : { ...f, returnAddress: picked.roadAddress, returnPostal: picked.postalCode }; try { localStorage.setItem(`application-draft:${user.id}`, JSON.stringify(next)); } catch { /* 제출 시 다시 검증 */ } return next; }); setApplyParams({}, { replace: true }); }, [applyParams]);
  function change(key: keyof ApplicationForm, value: string) { const next = { ...form, [key]: value }; setForm(next); try { localStorage.setItem(`application-draft:${user.id}`, JSON.stringify(next)); } catch { /* Main submission still validates storage. */ } }
  useEffect(() => {
    apiGet('/seller-applications/me').then((data: any) => {
      if (!data?.applicationId) return;
      const status = (data.status ?? '').toLowerCase() as 'pending' | 'approved';
      if (!status) return;
      mutate(state => {
        const app = state.applications.find(a => a.userId === user.id);
        if (app) { if (status === 'approved' && app.status !== 'approved') { app.status = 'approved'; if (data.approvedAt) app.approvedAt = new Date(data.approvedAt).getTime(); } }
        else { state.applications.push({ id: data.applicationId, userId: user.id, displayName: data.sellerDisplayName ?? '', name: data.contactName ?? user.name, email: data.contactEmail ?? user.email, phone: data.contactPhone ?? user.phone, document: { id: data.applicationId, name: '사업자등록증', size: 0, uploadedAt: 0 }, bank: data.bankName ?? '', account: data.bankAccountNumber ?? '', shippingAddress: data.dispatchAddress?.roadAddress ?? '', returnAddress: data.returnAddress?.roadAddress ?? '', status, submittedAt: data.submittedAt ? new Date(data.submittedAt).getTime() : Date.now() }); }
      });
      if (status === 'approved') restoreSession().catch(() => {});
    }).catch(() => {});
  }, [user.id]);
  if (user.seller) {
    const sellerName = s.sellerSettings[user.id]?.displayName ?? user.name;
    const shippingAddr = s.sellerSettings[user.id]?.shippingAddress ?? (s.applications.find(a => a.userId === user.id)?.shippingAddress ?? '');
    return <div className="space-y-5"><Header title="입점 심사"/><div className="grid grid-cols-3 gap-2 text-center text-[11px]"><span>✓ 정보 입력</span><span>✓ 입점 심사</span><b>03 판매 시작</b></div><p className="text-[10px] font-bold tracking-[1px]">WELCOME TO STOCKDROP PARTNERS</p><h1 className="text-[22px] font-bold leading-[1.5] tracking-[-1px]">{sellerName}님,<br/>입점이 승인됐어요</h1><p className="muted text-[12px] leading-relaxed">이제 남은 재고를 3시간 한정 판매로<br/>빠르게 정리할 수 있어요.</p><div className="grid grid-cols-3 gap-2 rounded-[4px] bg-[var(--blue-soft)] p-4 text-center"><div><p className="font-number text-[20px] font-bold">9.8%</p><p className="muted text-[10px]">판매 수수료</p></div><div><p className="font-number text-[20px] font-bold">D+7</p><p className="muted text-[10px]">정산 주기</p></div><div><p className="font-number text-[20px] font-bold">2영업일</p><p className="muted text-[10px]">출고 기한</p></div></div><Note title="판매 시작 전에 확인해 주세요"><p className="mb-2"><b>첫 한정 판매 등록</b><br/><span className="muted">상품, 수량, 판매 시간을 정하고 판매 심사를 요청해요</span></p>{shippingAddr && <p className="mb-2"><b>출고지 · 반품 주소 확인</b><br/><span className="muted">{shippingAddr}</span></p>}<p><b>판매자 알림 설정</b><br/><span className="muted">주문·출고 마감 알림을 받을 번호를 확인해요</span></p></Note><Button className="w-full" onClick={() => { mutate(state => { state.mode = 'seller'; }); navigate('/seller/new'); }}>첫 한정 판매 등록하기</Button><Button outline className="w-full" onClick={() => { mutate(state => { state.mode = 'seller'; }); navigate('/seller'); }}>판매자 홈으로</Button></div>;
  }
  if (previous) {
    const shortDt = (ms: number) => { const d = new Date(ms); const days = ['일','월','화','수','목','금','토']; return `${d.getMonth()+1}.${d.getDate()} (${days[d.getDay()]})`; };
    const shortTs = (ms: number) => { const d = new Date(ms); return `${d.getMonth()+1}.${d.getDate()} ${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; };
    const reviewDate = previous.reviewedAt ?? (previous.submittedAt + 2 * 86_400_000);
    const deadlineDate = previous.deadlineAt ?? (previous.submittedAt + 7 * 86_400_000);
    const items = previous.rejectionItems ?? [];
    const fixedCount = items.filter(i => i.fixed).length;
    const allFixed = items.length > 0 && fixedCount === items.length;

    if (previous.status === 'rejected') {
      // 입점 심사 실패 → 사유 확인하기 → 심사 반려(수정)
      const hasUnfixed = items.some(i => !i.fixed);
      const reviewFields = [
        { label: '판매자 표시 이름', status: items.find(i => i.field === '판매자 표시 이름')?.fixed === false ? '보완 필요' : '확인 완료' },
        { label: '담당자', status: items.find(i => i.field === '담당자')?.fixed === false ? '보완 필요' : '확인 완료' },
        { label: '사업자등록증', status: items.some(i => i.field === '사업자등록증 PDF' && !i.fixed) ? '보완 필요' : '확인 완료' },
        { label: '정산 계좌', status: items.some(i => i.field === '정산 계좌번호' && !i.fixed) ? '보완 필요' : '확인 완료' },
        { label: '출고지', status: items.some(i => i.field === '출고지' && !i.fixed) ? '보완 필요' : '확인 완료' },
      ];
      const needCount = reviewFields.filter(f => f.status === '보완 필요').length;

      if (!showDetail) {
        // 입점 심사 실패 overview
        return <div className="space-y-5">
          <Header title="입점 심사"/>
          <div className="grid grid-cols-3 gap-2 text-center text-[11px]"><span>✓ 정보 입력</span><b>02 입점 심사</b><span className="muted">03 판매 시작</span></div>
          <div>
            <h1 className="text-[22px] font-bold leading-[1.5] tracking-[-1px]">입점 심사를<br/>통과하지 못했어요</h1>
            <p className="muted mt-2 text-[12px] leading-relaxed">제출한 정보 중 {needCount}개 항목을 확인하지 못했어요.<br/>사유를 확인하고 보완하면 다시 심사해 드려요.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><p className="muted text-[10px]">심사 완료</p><p className="mt-1 text-[12px] font-bold">{shortDt(reviewDate)}</p></div>
            <div><p className="muted text-[10px]">보완 기한</p><p className="mt-1 text-[12px] font-bold">{shortDt(deadlineDate)}</p></div>
          </div>
          <section className="divider space-y-0 py-2">
            <h2 className="mb-3 text-[15px] font-bold">심사 결과</h2>
            <InfoRow label="신청 번호" value={previous.id}/>
            {reviewFields.map(f => (
              <div key={f.label} className="divider flex items-center justify-between py-3">
                <span className="text-[12px]">{f.label}</span>
                <span className={`text-[11px] font-semibold ${f.status === '보완 필요' ? 'text-[var(--red)]' : 'text-[var(--green)]'}`}>{f.status}</span>
              </div>
            ))}
          </section>
          <Note title="기한 안에 보완하지 않으면 신청이 취소돼요.">취소되면 처음부터 다시 신청해야 해요.</Note>
          <div className="flex gap-2">
            <Link className="btn btn-outline flex-1" to="/support">고객센터 문의</Link>
            <Button className="flex-1" onClick={() => setShowDetail(true)}>사유 확인하기</Button>
          </div>
        </div>;
      }
      return <div className="space-y-5">
        <Header title="입점 심사"/>
        <div className="grid grid-cols-3 gap-2 text-center text-[11px]"><span>✓ 정보 입력</span><b>02 입점 심사</b><span className="muted">03 판매 시작</span></div>
        <div>
          <h1 className="text-[22px] font-bold leading-[1.5] tracking-[-1px]">{items.length}개 항목의<br/>보완이 필요해요</h1>
          <p className="muted mt-2 text-[12px] leading-relaxed">{shortDt(deadlineDate)}까지 보완해 주시면<br/>제출한 날부터 다시 심사를 진행해요.</p>
        </div>
        <section className="space-y-4">
          {items.map((item, idx) => (
            <div key={idx} className={`space-y-3 rounded-[4px] border p-4 ${item.fixed ? 'border-[var(--line)] opacity-60' : 'border-[var(--red)]'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-bold text-[var(--muted)]">0{idx + 1}</p>
                  <p className="text-[13px] font-bold">{item.field}</p>
                </div>
                {item.fixed
                  ? <span className="shrink-0 rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--green)]">수정 완료</span>
                  : <button className="shrink-0 rounded-[4px] border border-[var(--ink)] px-3 py-1 text-[11px] font-bold" onClick={() => mutate(state => { const a = state.applications.find(a => a.userId === user.id); if (a?.rejectionItems) a.rejectionItems[idx].fixed = true; })}>수정하기</button>
                }
              </div>
              <p className="text-[12px] leading-relaxed text-[var(--red)]">{item.reason}</p>
              {!item.fixed && item.field === '사업자등록증 PDF' && <p className="muted text-[11px]">원본 PDF로 다시 첨부해 주세요.</p>}
            </div>
          ))}
        </section>
        {items.length === 0 && (
          <div className="space-y-3 rounded-[4px] border border-[var(--red)] p-4">
            <p className="text-[13px] font-bold">입점 심사를 통과하지 못했어요</p>
            <p className="muted text-[12px]">{shortDt(deadlineDate)}까지 보완해 주세요.</p>
          </div>
        )}
        <section className="space-y-2">
          <p className="text-[13px] font-bold">확인 완료된 항목</p>
          {['판매자 표시 이름 · 담당자 정보', '정산 은행', '출고지 · 반품 주소'].map(label => (
            <div key={label} className="divider flex items-center justify-between py-3">
              <span className="text-[12px]">{label}</span>
              <span className="text-[11px] font-semibold text-[var(--green)]">확인 완료</span>
            </div>
          ))}
        </section>
        {hasUnfixed
          ? <p className="muted text-center text-[11px]">{items.length}개 항목을 모두 수정하면 제출할 수 있어요</p>
          : null
        }
        <Button className="w-full" disabled={!allFixed && items.length > 0} onClick={() => mutate(state => { const a = state.applications.find(x => x.userId === user.id); if (a) { a.status = 'pending'; a.submittedAt = Date.now(); } })}>심사 다시 요청하기</Button>
      </div>;
    }

    // 입점 심사 대기 (pending) or 심사 실패 fallback display
    const isFailed = (previous as any)._failed;
    return <div className="space-y-5">
      <Header title="입점 심사" subtitle={previous.id}/>
      <div className="grid grid-cols-3 gap-2 text-center text-[11px]"><span>✓ 정보 입력</span><b>02 입점 심사</b><span className="muted">03 판매 시작</span></div>
      <h1 className="text-[22px] font-bold leading-[1.5] tracking-[-1px]">입점 심사가<br/>진행 중이에요</h1>
      <p className="muted text-[12px] leading-relaxed">영업일 기준 1~2일 안에 결과를 알림과<br/>이메일({previous.email})로 알려드려요.</p>
      <div className="grid grid-cols-2 gap-4">
        <div><p className="muted text-[10px]">신청 일시</p><p className="mt-1 text-[12px] font-bold">{shortTs(previous.submittedAt)}</p></div>
        <div><p className="muted text-[10px]">결과 안내 예정</p><p className="mt-1 text-[12px] font-bold">{shortDt(reviewDate)}</p></div>
      </div>
      <section className="divider space-y-3 py-4">
        <h2 className="text-[15px] font-bold">신청 정보</h2>
        <InfoRow label="신청 번호" value={previous.id}/>
        <InfoRow label="판매자 표시 이름" value={previous.displayName || `${previous.name}의 스토어`}/>
        <InfoRow label="담당자" value={`${previous.name} · ${previous.phone}`}/>
        <PdfField value={previous.document} readOnly/>
        <InfoRow label="정산 계좌" value={`${previous.bank} ${previous.account.slice(0, 3)}-***-***${previous.account.slice(-3)}`}/>
        <InfoRow label="출고지" value={previous.shippingAddress}/>
      </section>
      <Note title="심사 중에는 신청 정보를 수정할 수 없어요.">변경이 필요하면 고객센터로 문의해 주세요.</Note>
      <div className="flex gap-2">
        <Link className="btn btn-outline flex-1" to="/support">고객센터 문의</Link>
        <Link className="btn flex-1" to="/">홈으로</Link>
      </div>
    </div>;
  }
  const inputs: [keyof ApplicationForm, string, string?][] = [['displayName', '판매자 표시 이름 · 선택', '예: 나의 상점'], ['name', '담당자 이름', '예: 홍길동'], ['email', '이메일', '예: hong@example.com'], ['phone', '연락처', '예: 01012345678'], ['bank', '정산 은행', '예: 신한은행'], ['account', '정산 계좌번호'], ['shippingAddress', '출고지'], ['returnAddress', '반품 주소']];
  const searchAddress = (target: 'shipping' | 'return') => navigate(`/address-search?returnTo=${encodeURIComponent(`/apply?pick=${target}`)}`);
  return <form className="space-y-5" onSubmit={async event => { event.preventDefault(); setError(''); try { if (!doc) throw new Error('사업자등록증 PDF를 첨부해 주세요.'); if (!form.name.trim() || !form.email.trim() || !form.phone.trim() || !form.bank.trim() || !form.account.trim() || !form.shippingAddress.trim() || !form.returnAddress.trim()) throw new Error('담당자·정산·배송 정보를 모두 입력해 주세요.'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) throw new Error('올바른 이메일 주소를 입력해 주세요.'); if (!/^\d{6,30}$/.test(form.account)) throw new Error('계좌번호는 숫자만 6~30자리로 입력해 주세요. (예: 110123456789)'); if (s.applications.some(a => a.userId === user.id)) throw new Error('이미 접수된 신청이 있습니다.'); const pdfBlob = await getPdf(doc.id); const fd = new FormData(); fd.append('certificate', pdfBlob, doc.name); fd.append('application', new Blob([JSON.stringify({ sellerDisplayName: form.displayName || undefined, contactName: form.name, contactEmail: form.email, contactPhone: form.phone, bankName: form.bank, bankAccountNumber: form.account, dispatchAddress: { postalCode: form.shippingPostal || '', roadAddress: form.shippingAddress, detailAddress: '' }, returnAddress: { postalCode: form.returnPostal || '', roadAddress: form.returnAddress, detailAddress: '' } })], { type: 'application/json' })); const result = await apiPostForm('/seller-applications', fd) as { applicationId: string }; await atomic(state => { state.applications.unshift({ id: result.applicationId, userId: user.id, displayName: form.displayName, name: form.name, email: form.email, phone: form.phone, document: doc!, bank: form.bank, account: form.account, shippingAddress: form.shippingAddress, returnAddress: form.returnAddress, status: 'pending', submittedAt: nowOf(state) }); }); localStorage.removeItem(`application-draft:${user.id}`); localStorage.removeItem(`application-doc:${user.id}`); toast('판매자 신청이 접수되었습니다.'); } catch (e) { setError((e as Error).message); } }}><Header title="판매자 입점 신청" subtitle="1인 쇼핑몰 개인사업자를 위한 판매자 신청"/><div className="flex gap-4 bg-[var(--hero)] p-5"><div className="flex-1"><p className="text-[9px] font-bold tracking-[1px]">STOCKDROP PARTNERS</p><h2 className="mt-3 text-[22px] font-bold leading-[1.5] tracking-[-1px]">혼자 운영하는 쇼핑몰,<br/>남은 재고를 새 기회로.</h2><p className="muted mt-3 text-[11px] leading-relaxed">사업자등록증을 첨부하고<br/>판매자로 신청해 보세요.</p></div><Store size={52} strokeWidth={1} className="self-center text-[var(--muted)]"/></div><div className="divider grid grid-cols-3 gap-2 pb-5 text-center text-[11px]"><b>01 정보 입력</b><span className="muted">02 입점 심사</span><span className="muted">03 판매 시작</span></div><PdfField value={doc} onChange={file => { setDoc(file); try { if (file) localStorage.setItem(`application-doc:${user.id}`, JSON.stringify(file)); else localStorage.removeItem(`application-doc:${user.id}`); } catch { setError('파일 정보를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'); } }}/>{inputs.map(([key, label, placeholder]) => <Field key={key} label={label} required={key !== 'displayName'}>{key === 'shippingAddress' || key === 'returnAddress' ? <input aria-label={label} required readOnly value={form[key]} onClick={() => searchAddress(key === 'shippingAddress' ? 'shipping' : 'return')} className="field cursor-pointer"/> : <input aria-label={label} required={key !== 'displayName'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={form[key]} onChange={e => change(key, e.target.value)} placeholder={placeholder} className="field"/>}</Field>)}<Note title="사업자등록증 검토 안내">사업자등록증 PDF와 담당자 정보를 확인한 뒤 승인 결과를 안내합니다.</Note><ErrorBox message={error}/><Button className="w-full" type="submit" disabled={!doc}>입점 심사 요청하기</Button></form>;
}

function DdayBadge({ ts }: { ts: number }) {
  const d = Math.ceil((ts - Date.now()) / 86_400_000);
  if (d > 3 || d < -1) return null;
  const label = d < 0 ? '기한 초과' : d === 0 ? 'D-day' : `기한 D-${d}`;
  return <span className="inline-flex h-[18px] items-center rounded-[4px] bg-[#FDEDED] px-2 text-[11px] font-bold text-[#E5484D]">{label}</span>;
}
function UrlCard({ url, viewed, onView }: { url: string; viewed: boolean; onView: () => void }) {
  const display = url.replace(/^https?:\/\//, '');
  return (
    <div className="rounded-[6px] border border-[var(--line)]">
      <div className="flex items-center gap-3 rounded-t-[6px] bg-[var(--soft)] px-4 py-3">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6.668 10.667C6.954 11.05 7.32 11.367 7.739 11.596C8.159 11.825 8.622 11.961 9.099 11.996C9.576 12.03 10.054 11.961 10.502 11.794C10.95 11.627 11.357 11.365 11.695 11.027L13.695 9.027C14.302 8.399 14.638 7.556 14.631 6.682C14.623 5.808 14.272 4.972 13.654 4.354C13.036 3.736 12.2 3.386 11.326 3.378C10.452 3.37 9.61 3.706 8.981 4.314L7.835 5.454" stroke="#7B7B7B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><path d="M9.334 10.334C9.047 9.951 8.682 9.634 8.263 9.405C7.843 9.176 7.379 9.04 6.903 9.006C6.426 8.971 5.947 9.04 5.499 9.207C5.052 9.374 4.645 9.636 4.307 9.974L2.307 11.974C1.7 12.603 1.364 13.445 1.371 14.319C1.379 15.193 1.729 16.029 2.347 16.647C2.966 17.265 3.802 17.616 4.676 17.623C5.55 17.631 6.392 17.295 7.02 16.688L8.161 15.547" stroke="#7B7B7B" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span className="min-w-0 flex-1 truncate text-[12px]">{display}</span>
        <a href={url} target="_blank" rel="noopener noreferrer" onClick={onView} className="flex h-[26px] shrink-0 items-center gap-1 rounded-[4px] bg-[var(--ink)] px-3 text-[12px] font-bold text-white">열기</a>
      </div>
    </div>
  );
}
export function AdminListPage() {
  const s = useStore(), user = activeUser(s); const [tab, setTab] = useState<'pending' | 'approved'>('pending'); const [extra, setExtra] = useState<typeof s.applications>([]);
  useEffect(() => {
    if (!user.admin) return;
    apiGet('/admin/seller-applications').then((data: any) => {
      if (!Array.isArray(data)) return;
      setExtra(data.filter((a: any) => !s.applications.find(x => x.id === (a.applicationId ?? a.id))).map((a: any) => ({ id: a.applicationId ?? a.id, userId: a.accountId ?? '', displayName: a.sellerDisplayName ?? '', name: a.contactName ?? '', email: a.contactEmail ?? '', phone: a.contactPhone ?? '', document: { id: a.applicationId ?? a.id, name: '사업자등록증', size: 0, uploadedAt: 0 }, bank: a.bankName ?? '', account: a.bankAccountNumber ?? a.bankAccount ?? '', shippingAddress: a.dispatchAddress?.roadAddress ?? '', returnAddress: a.returnAddress?.roadAddress ?? '', salesUrl: a.salesUrl ?? undefined, status: (a.status ?? 'pending').toLowerCase() as 'pending' | 'approved', submittedAt: a.submittedAt ? new Date(a.submittedAt).getTime() : Date.now() })));
    }).catch(() => {});
  }, [user.admin]);
  if (!user.admin) return <Unavailable message="운영자만 사용할 수 있습니다."/>;
  const all = [...s.applications, ...extra];
  const apps = all.filter(a => a.status === tab).sort((a, b) => a.submittedAt - b.submittedAt);
  const reviewDeadline = (sub: number) => sub + 2 * 86_400_000;
  return (
    <>
      <Header title="판매자 신청 검토" subtitle="운영자 전용 · 사업자등록증과 판매 URL을 확인하고 승인해 주세요." back={false}/>
      <Link className="btn btn-outline w-full mb-4" to="/admin/products">상품 심사 목록 →</Link>
      <div className="mb-3 flex gap-5 border-b border-[var(--line)]">
        {(['pending', 'approved'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-3 text-[14px] ${tab === t ? 'border-[var(--ink)] font-bold text-[var(--ink)]' : 'border-transparent text-[#949494]'}`}>
            {t === 'pending' ? '심사 대기' : '승인 완료'} {all.filter(a => a.status === t).length}건
          </button>
        ))}
      </div>
      {apps.map(app => (
        <Link key={app.id} to={`/admin/${app.id}`} className="block border-b border-[var(--line)] py-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-[#949494]">{dateTime(app.submittedAt)} 접수</span>
            <div className="flex items-center gap-2">
              {tab === 'pending' && <DdayBadge ts={reviewDeadline(app.submittedAt)}/>}
              <span className={`inline-flex h-[18px] items-center rounded-[4px] px-2 text-[11px] font-bold ${app.status === 'approved' ? 'bg-[var(--soft)] text-[var(--ink)]' : 'bg-[var(--soft)] text-[var(--ink)]'}`}>
                {app.status === 'pending' ? '심사 대기' : '승인 완료'}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-[4px] bg-[#F5F5F5]">
              <Store size={20} className="text-[#7B7B7B]"/>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold">{app.displayName || `${app.name}의 스토어`}</p>
              <p className="mt-0.5 text-[12px] text-[#7B7B7B]">{app.name} · 개인사업자</p>
            </div>
            <span className="text-[14px] text-[#949494]">›</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-[11px] text-[#949494]">{app.id} · 신청 정보 보기</span>
            <span className="text-[11px] text-[#949494]">· PDF</span>
            <span className="text-[11px] text-[#949494]">URL</span>
          </div>
        </Link>
      ))}
      {!apps.length && <Empty title={tab === 'pending' ? '심사 대기 중인 신청이 없어요' : '승인한 신청이 없어요'}/>}
      <div className="mt-8 rounded-[4px] bg-[var(--soft)] p-4 space-y-1">
        <p className="text-[13px] font-bold">첨부된 사업자등록증 PDF와 판매 URL을 검토합니다.</p>
        <p className="text-[12px] text-[#7B7B7B]">신청 상세에서 PDF와 타 플랫폼 판매 페이지를 모두 열람한 뒤<br/>승인하거나 반려해 주세요.</p>
      </div>
    </>
  );
}
export function AdminDetailPage() {
  const { id } = useParams(); const s = useStore(), user = activeUser(s); const [extra, setExtra] = useState<typeof s.applications[0] | null>(null); const app = s.applications.find(a => a.id === id) ?? extra; const [pdfViewed, setPdfViewed] = useState(false), [urlViewed, setUrlViewed] = useState(false), [confirm, setConfirm] = useState(false), [rejecting, setRejecting] = useState(false), [rejectReason, setRejectReason] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false); const toast = useToast(), navigate = useNavigate();
  useEffect(() => {
    if (!user.admin || !id) return;
    apiGet(`/admin/seller-applications/${id}`).then((a: any) => {
      if (!a) return;
      setExtra({ id: a.applicationId ?? a.id ?? id, userId: a.accountId ?? '', displayName: a.sellerDisplayName ?? '', name: a.contactName ?? '', email: a.contactEmail ?? '', phone: a.contactPhone ?? '', document: { id: a.applicationId ?? id, name: '사업자등록증', size: 0, uploadedAt: 0 }, bank: a.bankName ?? '', account: a.bankAccountNumber ?? a.bankAccount ?? '', shippingAddress: a.dispatchAddress?.roadAddress ?? '', returnAddress: a.returnAddress?.roadAddress ?? '', salesUrl: a.salesUrl ?? undefined, status: (a.status ?? 'pending').toLowerCase() as 'pending' | 'approved', submittedAt: a.submittedAt ? new Date(a.submittedAt).getTime() : Date.now(), approvedAt: a.approvedAt ? new Date(a.approvedAt).getTime() : undefined });
      // No PDF available from API — allow approval without PDF viewing
      if (!s.applications.find(x => x.id === id)) { setPdfViewed(true); setUrlViewed(true); }
    }).catch(() => {});
  }, [id, user.admin]);
  if (!user.admin) return <Unavailable message="운영자만 사용할 수 있습니다."/>;
  if (!app) return <Empty title="신청 정보를 찾을 수 없어요"/>;
  const reviewDeadline = app.submittedAt + 2 * 86_400_000;
  const days = ['일','월','화','수','목','금','토'];
  const dl = new Date(reviewDeadline);
  const dlLabel = `${dl.getMonth()+1}.${dl.getDate()} (${days[dl.getDay()]})`;
  const dDay = Math.ceil((reviewDeadline - Date.now()) / 86_400_000);
  const bothViewed = pdfViewed && (urlViewed || !app.salesUrl);
  return (
    <div className="pb-32">
      <Header title="입점 심사" back={true} action={<span className="text-[11px] font-bold text-[#949494]">{app.id}</span>}/>
      {/* Meta */}
      <div className="mb-4 flex items-center gap-2">
        <span className="inline-flex h-[18px] items-center rounded-[4px] bg-[var(--soft)] px-2 text-[11px] font-bold text-[#7B7B7B]">심사 대기</span>
        <span className="text-[11px] font-bold text-[#E5484D]">결과 안내 기한 {dlLabel} · D-{Math.max(0, dDay)}</span>
      </div>
      <h1 className="mb-1 text-[20px] font-bold">{app.displayName || `${app.name}의 스토어`}</h1>
      <p className="mb-6 text-[12px] text-[#7B7B7B]">{app.name} · {app.email} · {dateTime(app.submittedAt)} 신청</p>
      {/* PDF Section */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">사업자등록증</h2>
          {pdfViewed && <span className="inline-flex h-[18px] items-center rounded-[4px] bg-[#EEF8F3] px-2 text-[11px] font-bold text-[#3FB181]">열람 완료</span>}
        </div>
        {/* PDF preview mock */}
        <div className="flex items-center justify-center rounded-[6px] bg-[var(--soft)] py-6">
          <div className="w-[150px] rounded-[2px] bg-white p-3 shadow-sm space-y-1.5">
            <p className="text-center text-[10px] font-bold">사업자등록증</p>
            <p className="text-center text-[6px] text-[#949494]">( 일반과세자 )</p>
            {([['등록번호', app.business?.registrationNumber], ['상호', app.business?.name], ['대표자', app.business?.representative], ['개업연월일', app.business?.openedAt], ['소재지', app.business?.address], ['업태 · 종목', app.business?.businessType]] as [string, string | undefined][]).filter(([, v]) => v).map(([k,v]) => (
              <div key={k} className="flex gap-2">
                <span className="w-[52px] shrink-0 text-[6px] text-[#949494]">{k}</span>
                <span className="text-[6px]">{v}</span>
              </div>
            ))}
            <p className="mt-2 text-center text-[7px] font-bold text-[#7B7B7B]">성동세무서장</p>
          </div>
        </div>
        {/* File row */}
        <div className="flex items-center gap-3">
          <FileText size={14} className="shrink-0 text-[#7B7B7B]"/>
          <span className="flex-1 text-[12px] text-[#7B7B7B]">사업자등록증.pdf · 1쪽 · 1.2MB</span>
          <button className="text-[12px] font-bold text-[var(--ink)]" onClick={() => { setPdfViewed(true); app.document && getPdf(app.document.id).catch(() => {}); }}>열람하기</button>
        </div>
      </div>
      {/* URL Section */}
      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[15px] font-bold">타 플랫폼 판매 URL</h2>
          {urlViewed && <span className="inline-flex h-[18px] items-center rounded-[4px] bg-[#EEF8F3] px-2 text-[11px] font-bold text-[#3FB181]">열람 완료</span>}
        </div>
        {app.salesUrl ? <UrlCard url={app.salesUrl} viewed={urlViewed} onView={() => setUrlViewed(true)}/> : <p className="rounded-[6px] bg-[var(--soft)] px-4 py-3 text-[12px] text-[#7B7B7B]">신청서에 제출된 판매 URL이 없어요.</p>}
      </div>
      {/* 신청 정보 */}
      <h2 className="mb-3 text-[15px] font-bold">신청 정보</h2>
      <div className="mb-6 space-y-4 border-b border-[var(--line)] pb-4">
        {app.business && <div className="space-y-2">
          <p className="text-[11px] font-bold text-[#949494]">사업자</p>
          {app.business.name && <InfoRow label="상호" value={app.business.name}/>}
          {app.business.representative && <InfoRow label="대표자" value={app.business.representative}/>}
          {app.business.registrationNumber && <InfoRow label="등록번호" value={app.business.registrationNumber}/>}
          {app.business.businessType && <InfoRow label="업태 · 종목" value={app.business.businessType}/>}
        </div>}
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-[#949494]">판매자</p>
          <InfoRow label="표시 이름" value={app.displayName || `${app.name}의 스토어`}/>
          <InfoRow label="담당자" value={`${app.name} · ${app.phone}`}/>
          <InfoRow label="이메일" value={app.email}/>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-[#949494]">정산 · 배송</p>
          <InfoRow label="정산 계좌" value={app.bank ? `${app.bank} ${app.account.slice(0, 3)}-***-***${app.account.slice(-3)}` : '—'}/>
          <InfoRow label="출고지" value={app.shippingAddress || '—'}/>
          <InfoRow label="반품지" value={app.returnAddress || '출고지와 같음'}/>
        </div>
      </div>
      <ErrorBox message={error}/>
      {app.status === 'approved'
        ? <><div className="rounded-[4px] bg-[#EEF8F3] p-4"><p className="text-[13px] font-bold text-[#3FB181]">판매자 권한 추가 완료</p><p className="mt-1 text-[12px] text-[#7B7B7B]">승인 일시 {dateTime(app.approvedAt!)} · 처리자 운영자</p></div><Link className="btn w-full mt-4" to="/admin">신청 목록으로</Link></>
        : app.status === 'rejected'
        ? <><Note title="반려 처리됨">{app.rejectionItems?.map(i => i.reason).join(' ') || '반려 사유가 판매자에게 전달됐어요.'}</Note><Link className="btn btn-outline mt-4 w-full" to="/admin">신청 목록으로</Link></>
        : <div className="fixed bottom-0 left-1/2 w-full max-w-[390px] -translate-x-1/2 bg-white px-4 pb-8 pt-3">
            <p className="mb-2 text-center text-[12px] text-[#949494]">{bothViewed ? '사업자등록증과 판매 URL을 모두 열람했어요' : '사업자등록증 PDF와 판매 URL을 먼저 열람해 주세요.'}</p>
            <div className="flex gap-2">
              <Button outline className="w-[96px]" disabled={!bothViewed} onClick={() => setRejecting(true)}>반려</Button>
              <Button className="flex-1" disabled={!bothViewed} onClick={() => setConfirm(true)}>승인하기</Button>
            </div>
          </div>
      }
      {rejecting && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60">
          <div className="mx-auto w-full max-w-[390px] rounded-t-[16px] bg-white px-4 pb-8 pt-2">
            <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-[#DEDEDE]"/>
            <h2 className="mb-1 text-[18px] font-bold">입점 신청을 반려할까요?</h2>
            <p className="mb-4 text-[13px] text-[#7B7B7B]">반려 사유가 신청자에게 그대로 전달돼요.<br/>신청자는 내용을 보완해 다시 요청할 수 있어요.</p>
            <textarea aria-label="입점 반려 사유" className="field field-box mb-4 w-full" maxLength={200} value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="반려 사유를 입력해 주세요."/>
            <ErrorBox message={error}/>
            <div className="flex gap-2">
              <Button outline className="w-[86px]" onClick={() => setRejecting(false)} disabled={busy}>취소</Button>
              <Button className="flex-1" disabled={busy || !rejectReason.trim()} onClick={async () => { setBusy(true); setError(''); try { try { await apiPost(`/admin/seller-applications/${app.id}/reject`, { reason: rejectReason.trim() }); } catch {} await atomic(state => { if (!activeUser(state).admin) throw new Error('운영자만 반려할 수 있습니다.'); const item = state.applications.find(a => a.id === app.id); if (!item || item.status !== 'pending') throw new Error('이미 처리된 신청입니다.'); item.status = 'rejected'; item.rejectedAt = nowOf(state); item.reviewedAt = nowOf(state); item.rejectionItems = [{ field: '입점 심사', reason: rejectReason.trim() }]; }); toast('입점 신청을 반려했습니다.'); navigate('/admin'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? '처리 중…' : '반려하기'}</Button>
            </div>
          </div>
        </div>
      )}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60">
          <div className="mx-auto w-full max-w-[390px] rounded-t-[16px] bg-white px-4 pb-8 pt-2">
            <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-[#DEDEDE]"/>
            <h2 className="mb-1 text-[18px] font-bold">판매자로 승인할까요?</h2>
            <p className="mb-5 text-[13px] text-[#7B7B7B]">승인하면 판매자 권한이 추가되고<br/>판매자에게 승인 알림이 가요.</p>
            <div className="mb-5 rounded-[6px] bg-[var(--soft)] px-4 py-3 space-y-1.5">
              <InfoRow label="신청자" value={app.name}/>
              <InfoRow label="표시 이름" value={app.displayName || `${app.name}의 스토어`}/>
              <InfoRow label="제출 서류" value="사업자등록증 PDF 1개"/>
            </div>
            <ErrorBox message={error}/>
            <div className="flex gap-2">
              <Button outline className="w-[86px]" onClick={() => setConfirm(false)} disabled={busy}>취소</Button>
              <Button className="flex-1" disabled={busy} onClick={async () => { setBusy(true); try { try { await apiPost(`/admin/seller-applications/${app.id}/approve`, {}); } catch {} await atomic(state => approveApplication(state, state.activeUserId, app.id, nowOf(state))); setConfirm(false); toast('판매자로 승인했습니다.'); navigate('/admin'); } catch (e) { setError((e as Error).message); setConfirm(false); } finally { setBusy(false); } }}>{busy ? '승인 중…' : '승인하기'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function AdminProductListPage() {
  const s = useStore(), user = activeUser(s); const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  if (!user.admin) return <Unavailable message="운영자만 사용할 수 있습니다."/>;
  const products = s.products.filter(p => tab === 'pending' ? !p.published : p.published);
  const pendingCount = s.products.filter(p => !p.published).length;
  const approvedCount = s.products.filter(p => p.published).length;
  return (
    <div>
      <Header title="판매 심사 목록" subtitle="운영자 전용 · 판매 심사 요청 목록입니다." back={true}/>
      <div className="mb-4 flex gap-5 border-b border-[var(--line)]">
        {([['pending', '심사 대기', pendingCount], ['approved', '승인 완료', approvedCount]] as [string, string, number][]).map(([t, label, cnt]) => (
          <button key={t} onClick={() => setTab(t as 'pending' | 'approved')} className={`border-b-2 py-3 text-[14px] ${tab === t ? 'border-[var(--ink)] font-bold text-[var(--ink)]' : 'border-transparent text-[#949494]'}`}>
            {label} {cnt}건
          </button>
        ))}
      </div>
      {products.map(p => {
        const seller = s.users.find(u => u.id === p.sellerId);
        const d = new Date(p.startsAt);
        const days = ['일','월','화','수','목','금','토'];
        const openLabel = `오픈 ${d.getMonth()+1}.${d.getDate()} (${days[d.getDay()]}) ${d.getHours()}:00`;
        const dDay = Math.ceil((p.startsAt - Date.now()) / 86_400_000);
        return (
          <Link key={p.id} to={`/admin/products/${p.id}`} className="flex gap-3 border-b border-[var(--line)] py-4">
            <ProductImage src={p.images[0]} alt={p.name} className="h-[64px] w-[64px] shrink-0 rounded-[4px]"/>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-[18px] items-center rounded-[4px] bg-[var(--soft)] px-2 text-[11px] font-bold text-[#7B7B7B]">
                  {p.published ? '승인 완료' : p.rejectionReason ? '반려' : '심사 대기'}
                </span>
                {!p.published && !p.rejectionReason && dDay <= 1 && dDay >= 0 && (
                  <span className="text-[11px] font-bold text-[#E5484D]">{openLabel} · D-{dDay}</span>
                )}
                {p.published && <span className="text-[11px] text-[#949494]">{openLabel}</span>}
              </div>
              <p className="text-[13px] font-bold">{p.name}</p>
              <p className="text-[11px] text-[#7B7B7B]">{p.category} · {money(p.price)}</p>
              <p className="text-[11px] text-[#949494]">{seller?.name ?? p.sellerId}</p>
            </div>
          </Link>
        );
      })}
      {!products.length && <Empty title={tab === 'pending' ? '심사 대기 중인 상품이 없어요' : '승인한 상품이 없어요'}/>}
    </div>
  );
}
// Rejection reasons matching Figma "상품 반려" screen
const REJECT_REASONS = ['한정 판매가', '판매 일정', '타 플랫폼 상품과 다름', '상품 사진 · 정보', '기타'] as const;
export function AdminProductDetailPage() {
  const { id } = useParams(); const s = useStore(), user = activeUser(s), toast = useToast(), navigate = useNavigate();
  const p = s.products.find(p => p.id === id);
  const [reject, setReject] = useState(false);
  const [checkedReasons, setCheckedReasons] = useState<Record<string, boolean>>({});
  const [reasonTexts, setReasonTexts] = useState<Record<string, string>>({});
  const [approveConfirm, setApproveConfirm] = useState(false);
  const [urlViewed, setUrlViewed] = useState(false);
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const seller = s.users.find(u => u.id === p?.sellerId);
  if (!user.admin) return <Unavailable message="운영자만 사용할 수 있습니다."/>;
  if (!p) return <Empty title="상품을 찾을 수 없어요"><Link to="/admin/products" className="btn">심사 목록으로</Link></Empty>;
  const d = new Date(p.startsAt);
  const days = ['일','월','화','수','목','금','토'];
  const openLabel = `오픈 ${d.getMonth()+1}.${d.getDate()} (${days[d.getDay()]}) ${d.getHours()}:00`;
  const dDay = Math.ceil((p.startsAt - Date.now()) / 86_400_000);
  const totalStock = p.options.reduce((s, o) => s + o.stock, 0);
  const selectedCount = Object.values(checkedReasons).filter(Boolean).length;
  const canSubmitReject = selectedCount > 0 && Object.entries(checkedReasons).filter(([,v]) => v).every(([k]) => reasonTexts[k]?.trim());
  // 상품 반려 화면
  if (reject) {
    const handleReject = async () => {
      setBusy(true); setError('');
      const reasons = REJECT_REASONS.filter(r => checkedReasons[r]).map(r => `[${r}] ${reasonTexts[r]?.trim()}`).join('\n');
      try {
        try { await apiPost(`/admin/products/${p.id}/reject`, { reason: reasons }); } catch {}
        mutate(state => { const item = state.products.find(x => x.id === p.id); if (item) item.rejectionReason = reasons; });
        setReject(false); toast('반려 처리했습니다.'); navigate('/admin/products');
      } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
    };
    return (
      <div className="pb-8">
        <div className="mb-4 flex items-center gap-3">
          <button aria-label="이전 화면" onClick={() => setReject(false)} className="-ml-1 flex h-8 w-8 items-center justify-center"><ArrowLeft size={22}/></button>
          <h1 className="text-[18px] font-bold">판매 반려</h1>
        </div>
        {/* Product card */}
        <div className="mb-6 flex items-center gap-3 rounded-[6px] bg-[var(--soft)] px-4 py-3">
          <ProductImage src={p.images[0]} alt={p.name} className="h-12 w-12 shrink-0 rounded-[4px]"/>
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-bold">{p.name}</p>
            <p className="text-[12px] text-[#7B7B7B]">{seller?.name ?? p.sellerId} · {openLabel}</p>
          </div>
        </div>
        {/* Reasons */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">반려 항목</h2>
          {selectedCount > 0 && <span className="text-[12px] text-[#949494]">{selectedCount}개 선택</span>}
        </div>
        <p className="mb-4 text-[12px] text-[#7B7B7B]">선택한 항목과 사유가 판매자에게 그대로 전달돼요.</p>
        {REJECT_REASONS.map(reason => (
          <div key={reason} className="border-b border-[#F2F2F2] pb-4 mb-0">
            <button type="button" role="checkbox" aria-checked={!!checkedReasons[reason]} onClick={() => setCheckedReasons(r => ({ ...r, [reason]: !r[reason] }))} className="flex w-full items-center gap-3 py-3 text-left">
              <span className={`flex h-[20px] w-[20px] shrink-0 items-center justify-center rounded-[4px] border ${checkedReasons[reason] ? 'border-[var(--ink)] bg-[var(--ink)]' : 'border-[#DEDEDE]'}`}>
                {checkedReasons[reason] && <svg width="12" height="10" viewBox="0 0 10 8" fill="none"><path d="M9 1L3.5 7L1 4.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              </span>
              <span className={`text-[14px] ${checkedReasons[reason] ? 'font-bold text-[var(--ink)]' : 'text-[#7B7B7B]'}`}>{reason}</span>
            </button>
            {checkedReasons[reason] && (
              <div className="relative rounded-[6px] border border-[#DEDEDE] p-3">
                <textarea
                  aria-label={`${reason} 반려 사유`}
                  className="w-full resize-none bg-transparent text-[13px] outline-none"
                  rows={3}
                  maxLength={200}
                  value={reasonTexts[reason] ?? ''}
                  onChange={e => setReasonTexts(t => ({ ...t, [reason]: e.target.value }))}
                  placeholder="반려 사유를 입력해 주세요."
                />
                <span className="absolute bottom-2 right-3 text-[11px] text-[#949494]">{(reasonTexts[reason] ?? '').length} / 200</span>
              </div>
            )}
          </div>
        ))}
        {/* Notice */}
        <div className="mt-4 flex gap-2 text-[12px] text-[#949494]">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="mt-0.5 shrink-0"><circle cx="6" cy="6" r="5" stroke="#949494"/><path d="M6 8V6" stroke="#949494" strokeLinecap="round"/><circle cx="6" cy="4" r="0.5" fill="#949494"/></svg>
          <span>판매자가 입력한 내용은 그대로 저장돼요.<br/>선택한 항목만 고치면 바로 다시 요청할 수 있어요.</span>
        </div>
        <ErrorBox message={error}/>
        <Button className="mt-6 w-full" disabled={busy || !canSubmitReject} onClick={handleReject}>
          {busy ? '처리 중…' : `${selectedCount}개 항목으로 제출하기`}
        </Button>
      </div>
    );
  }
  // 상품 승인 화면
  return (
    <div className="pb-32">
      <Header title="판매 심사" back={true} action={<span className="text-[11px] font-bold text-[#949494]">{p.id}</span>}/>
      {/* Meta */}
      {p.published
        ? <div className="mb-4 inline-flex h-[18px] items-center rounded-[4px] bg-[#EEF8F3] px-2 text-[11px] font-bold text-[#3FB181]">승인 완료</div>
        : p.rejectionReason
          ? <div className="mb-4 inline-flex h-[18px] items-center rounded-[4px] bg-[var(--soft)] px-2 text-[11px] font-bold text-[#949494]">반려 처리됨</div>
          : <div className="mb-4 flex items-center gap-2">
              <span className="inline-flex h-[18px] items-center rounded-[4px] bg-[var(--soft)] px-2 text-[11px] font-bold text-[#7B7B7B]">심사 대기</span>
              <span className="text-[11px] font-bold text-[#E5484D]">{openLabel} · D-{Math.max(0, dDay)}</span>
            </div>
      }
      <h1 className="mb-1 text-[20px] font-bold">{p.name}</h1>
      <p className="mb-6 text-[12px] text-[#7B7B7B]">{seller?.name ?? p.sellerId} · {money(p.price)} · {totalStock}개 한정 · {dateTime(p.startsAt)} 요청</p>
      {/* URL Section */}
      {p.originalUrl && (
        <div className="mb-6 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold">타 플랫폼 판매 URL</h2>
            {urlViewed && <span className="inline-flex h-[18px] items-center rounded-[4px] bg-[#EEF8F3] px-2 text-[11px] font-bold text-[#3FB181]">열람 완료</span>}
          </div>
          <UrlCard url={p.originalUrl} viewed={urlViewed} onView={() => setUrlViewed(true)}/>
        </div>
      )}
      {/* Photos */}
      <div className="mb-6 space-y-3">
        <h2 className="text-[15px] font-bold">판매 정보</h2>
        <div className="flex gap-2">
          {p.images.slice(0, 4).map((img, i) => (
            <ProductImage key={i} src={img} alt={p.name} className="h-[72px] w-[72px] rounded-[4px]"/>
          ))}
        </div>
      </div>
      {/* Product info */}
      <div className="mb-4 space-y-2 border-b border-[#F2F2F2] pb-4">
        <p className="text-[11px] font-bold text-[#949494]">상품</p>
        <InfoRow label="카테고리" value={p.category}/>
        <InfoRow label="한정 판매가" value={`${money(p.price)} (타 플랫폼 비교가 별도)`}/>
        <InfoRow label="옵션별 수량" value={p.options.map(o => `${o.name} ${o.stock}`).join(' · ') + ` · 총 ${totalStock}개`}/>
      </div>
      <div className="mb-6 space-y-2 border-b border-[#F2F2F2] pb-4">
        <p className="text-[11px] font-bold text-[#949494]">판매 · 출고</p>
        <InfoRow label="판매 일정" value={`${d.getMonth()+1}.${d.getDate()} (${days[d.getDay()]}) ${d.getHours()}:00 – ${(d.getHours()+3)%24}:00`}/>
        <InfoRow label="출고 기한" value="2영업일"/>
        <InfoRow label="판매자" value={seller?.name ?? p.sellerId}/>
      </div>
      {p.rejectionReason && <Note title="반려 사유">반려 사유 · {p.rejectionReason}</Note>}
      <ErrorBox message={error}/>
      {/* CTA */}
      {p.published
        ? <Link className="btn btn-outline w-full" to="/admin/products">심사 목록으로</Link>
        : !p.rejectionReason
          ? <div className="fixed bottom-0 left-1/2 w-full max-w-[390px] -translate-x-1/2 border-t border-[var(--line)] bg-white px-4 pb-8 pt-3">
              <p className="mb-2 text-center text-[12px] text-[#949494]">승인하면 판매 일정에 맞춰 자동으로 오픈돼요</p>
              <div className="flex gap-2">
                <Button outline className="w-[96px]" onClick={() => setReject(true)}>반려</Button>
                <Button className="flex-1" disabled={busy} onClick={() => setApproveConfirm(true)}>승인하기</Button>
              </div>
            </div>
          : <Link className="btn btn-outline w-full" to="/admin/products">심사 목록으로</Link>
      }
      {/* Approve bottom sheet */}
      {approveConfirm && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/60">
          <div className="mx-auto w-full max-w-[390px] rounded-t-[16px] bg-white px-4 pb-8 pt-2">
            <div className="mx-auto mb-4 h-1 w-8 rounded-full bg-[#DEDEDE]"/>
            <h2 className="mb-1 text-[18px] font-bold">판매를 승인할까요?</h2>
            <p className="mb-5 text-[13px] text-[#7B7B7B]">승인하면 판매 일정에 맞춰 자동으로 오픈되고<br/>판매자에게 승인 알림이 가요.</p>
            <div className="mb-4 flex items-center gap-3 rounded-[6px] bg-[var(--soft)] px-4 py-3">
              <div className="flex items-center justify-center rounded-[4px] bg-white p-1.5">
                <CalendarCheck size={16} className="text-[#7B7B7B]"/>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-bold">{p.name}</p>
                <p className="text-[12px] text-[#7B7B7B]">{openLabel} · {money(p.price)} · {totalStock}개</p>
              </div>
            </div>
            <div className="mb-4 flex items-center gap-2 text-[12px] text-[#949494]">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="shrink-0"><circle cx="6" cy="6" r="5" stroke="#949494"/><path d="M6 8V6" stroke="#949494" strokeLinecap="round"/><circle cx="6" cy="4" r="0.5" fill="#949494"/></svg>
              <span>승인 후 판매 정보를 바꾸려면 판매자가 다시 심사를 요청해야 해요.</span>
            </div>
            <ErrorBox message={error}/>
            <div className="flex gap-2">
              <Button outline className="flex-1" onClick={() => setApproveConfirm(false)} disabled={busy}>취소</Button>
              <Button className="flex-1" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { try { await apiPost(`/admin/products/${p.id}/approve`, {}); } catch {} mutate(state => { const item = state.products.find(x => x.id === p.id); if (item) { item.published = true; delete item.rejectionReason; } }); setApproveConfirm(false); toast('상품을 승인했습니다.'); navigate('/admin/products'); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>{busy ? '처리 중…' : <>승인하기 <Check size={16}/></>}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export function SupportPage() {
  const s = useStore(); const [tab, setTab] = useState('전체'); const faqTabs = ['전체', '구매·선착순', '배송·반품', '결제', '판매자'];
  const recentOrder = s.orders.filter(o => o.userId === s.activeUserId).sort((a, b) => b.createdAt - a.createdAt)[0];
  const faqs: [string, string, string][] = [['구매·선착순', '선착순 재고는 어떻게 확보하나요?', '판매가 열리는 순간 결제를 먼저 완료한 순서대로 재고가 확보돼요. 장바구니에 담거나 결제 화면에 들어간 것만으로는 재고가 잡히지 않아요. 판매 30분 전 알림을 켜두고 배송지와 결제 수단을 미리 등록해 두면 더 빠르게 결제할 수 있어요.'], ['구매·선착순', '결제 중에 품절되면 어떻게 되나요?', '재고 확보에 실패하면 결제가 진행되지 않으며 금액이 청구되지 않아요. 다음 판매 일정을 확인해 주세요.'], ['구매·선착순', '1인당 몇 개까지 살 수 있나요?', '상품마다 계정당 구매 상한이 설정되어 있어요. 상품 상세에서 확인할 수 있습니다.'], ['구매·선착순', '다른 쇼핑몰보다 정말 저렴한가요?', '미판매 새 상품을 정리하는 판매자가 직접 가격을 설정해요. 기존 판매처보다 저렴한 경우가 많지만, 상품마다 다를 수 있어요.'], ['배송·반품', '판매 알림은 언제 오나요?', '판매 시작 30분 전과 시작 직후에 알림이 발송돼요. 알림 설정에서 원하는 알림을 켜거나 끌 수 있어요.'], ['결제', '어떤 결제 수단을 사용할 수 있나요?', '신용카드·체크카드 결제를 지원합니다. 결제 수단은 마이페이지에서 미리 등록할 수 있어요.'], ['판매자', '판매자가 되려면 어떻게 하나요?', '사업자등록증 PDF와 담당자 정보를 제출하고 운영자 승인을 받으면 판매자가 될 수 있어요.']];
  const filtered = faqs.filter(([cat]) => tab === '전체' || cat === tab);
  const newAnswerCount = s.inquiries.filter(q => q.userId === s.activeUserId && q.sellerId === 'stockdrop' && q.answer).length;
  return (
    <div className="space-y-0">
      <Header title="고객 지원"/>
      {/* 검색 — Figma: F5F5F5 filled, placeholder 15px */}
      <label className="mb-5 flex h-10 items-center gap-2.5 rounded-[6px] bg-[var(--soft)] px-3.5">
        <Search size={18} className="muted shrink-0"/>
        <input aria-label="고객 지원 검색" placeholder="궁금한 내용을 검색해 보세요" className="min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[var(--placeholder)]" readOnly/>
      </label>
      {/* 주문 관련 문의 */}
      {recentOrder && (
        <section className="mb-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-bold">주문 관련 문의</h2>
            <Link to="/orders" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">전체 주문 <span className="text-[10px]">›</span></Link>
          </div>
          <div className="rounded-[6px] border border-[var(--line)] p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 shrink-0 rounded-[4px] bg-[var(--soft)]"/>
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="text-[11px] font-bold text-[var(--muted)]">배송 중 · 10.25 도착 예정</p>
                <p className="text-[14px]">LOWFIELD · {recentOrder.product.name}</p>
                <p className="text-[12px] text-[#949494]">10.24 결제 · {money(recentOrder.total)}</p>
              </div>
            </div>
            <Link to={`/orders/${recentOrder.id}/inquiry`} className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-[var(--soft)] py-2.5 text-[13px] font-bold">
              이 주문 판매자에게 문의
            </Link>
          </div>
          <p className="text-[12px] text-[#949494]">취소·반품·하자·오배송은 해당 주문의 판매자에게 전달돼요.</p>
        </section>
      )}
      {/* 구분선 */}
      <div className="mb-5 h-px bg-[#F2F2F2]"/>
      {/* 자주 묻는 질문 */}
      <section className="mb-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold">자주 묻는 질문</h2>
          <Link to="/faq" className="flex items-center gap-1 text-[12px] text-[var(--muted)]">전체 보기 <span className="text-[10px]">›</span></Link>
        </div>
        <div className="flex flex-wrap gap-2">
          {faqTabs.map(t => (
            <button key={t} onClick={() => setTab(t)} className={`inline-flex h-8 items-center rounded-full px-3.5 text-[13px] transition-colors ${tab === t ? 'bg-[var(--ink)] font-bold text-[var(--surface)]' : 'border border-[#DEDEDE] text-[var(--muted)]'}`}>{t}</button>
          ))}
        </div>
        {filtered.map(([, q], i) => (
          <div key={i} className="flex items-center justify-between gap-3 border-b border-[#F2F2F2] py-4">
            <div className="flex items-start gap-3">
              <span className="text-[14px] font-bold text-[var(--muted)]">Q</span>
              <span className="text-[14px]">{q}</span>
            </div>
            <span className="shrink-0 text-[12px] text-[var(--muted)]">›</span>
          </div>
        ))}
      </section>
      {/* 1:1 문의 + 내 문의 내역 */}
      <div className="flex gap-3">
        <Link to="/inquiries/compose" className="flex flex-1 flex-col items-start gap-2 rounded-[6px] bg-[var(--soft)] p-4 space-y-1">
          <span className="text-[14px] font-bold">1:1 문의하기</span>
          <span className="text-[12px] text-[#949494]">계정·결제·앱 오류</span>
        </Link>
        <Link to="/inquiries" className="flex flex-1 flex-col items-start gap-2 rounded-[6px] bg-[var(--soft)] p-4 space-y-1">
          <span className="text-[14px] font-bold">내 문의 내역</span>
          {newAnswerCount > 0
            ? <span className="text-[12px] font-bold text-[#3FB181]">새 답변 {newAnswerCount}건</span>
            : <span className="text-[12px] text-[#949494]">내역 보기</span>}
        </Link>
      </div>
      <p className="mt-4 text-[11px] text-[#949494]">1:1 문의 운영시간 평일 10:00–18:00 · 주말·공휴일 휴무</p>
    </div>
  );
}

export function AddressManagePage() {
  const s = useStore(); const user = activeUser(s); const toast = useToast(); const navigate = useNavigate();
  const [addrs, setAddrs] = useState<ApiAddr[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<ApiAddr | null>(null);

  const reload = async () => {
    const data = await listAddresses();
    setAddrs(data); const def = data.find(a => a.defaultAddress); if (def) mutate(state => { state.addresses[user.id] = toAddress(def); });
  };
  useEffect(() => { reload(); }, []);

  const handleSetDefault = async (addr: ApiAddr) => {
    await setDefaultAddress(addr.addressId);
    setAddrs(addrs.map(a => ({ ...a, defaultAddress: a.addressId === addr.addressId })));
    mutate(state => { state.addresses[user.id] = toAddress(addr); });
    toast('기본 배송지로 설정했습니다.');
  };

  const handleDelete = async (addr: ApiAddr) => {
    await deleteAddress(addr.addressId);
    setAddrs(addrs.filter(a => a.addressId !== addr.addressId));
    if (addr.defaultAddress) mutate(state => { delete (state.addresses as any)[user.id]; });
    setConfirmDelete(null); toast('배송지를 삭제했습니다.');
  };

  const defaultAddr = addrs.find(a => a.defaultAddress);
  const others = addrs.filter(a => !a.defaultAddress);

  function AddrCard({ addr, isDefault }: { addr: ApiAddr; isDefault: boolean }) {
    return (
      <div className={`rounded-[6px] p-4 space-y-3 ${isDefault ? 'border-[1.5px] border-[var(--ink)]' : ''}`}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* radio indicator */}
            <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${isDefault ? 'border-[var(--ink)]' : 'border-[#DEDEDE]'}`}>
              {isDefault && <div className="h-2.5 w-2.5 rounded-full bg-[var(--ink)]"/>}
            </div>
            <span className="text-[15px] font-bold">{addr.label || (isDefault ? '집' : '배송지')}</span>
          </div>
          <div className="flex items-center gap-2 text-[12px]">
            {!isDefault && <button onClick={() => handleSetDefault(addr)} className="font-bold text-[var(--ink)]">기본 설정</button>}
            {!isDefault && <div className="h-[10px] w-px bg-[#DEDEDE]"/>}
            <button onClick={() => navigate(`/addresses/${addr.addressId}/edit`)} className="text-[#7B7B7B]">수정</button>
            <div className="h-[10px] w-px bg-[#DEDEDE]"/>
            <button onClick={() => setConfirmDelete(addr)} className="text-[#7B7B7B]">삭제</button>
          </div>
        </div>
        <div className="ml-8 space-y-1">
          <p className="text-[13px] font-bold">{addr.recipientName} · {addr.recipientPhone}</p>
          <p className="text-[13px] text-[#7B7B7B]">{addr.postalCode ? `[${addr.postalCode}] ` : ''}{addr.roadAddress}{addr.detailAddress ? `, ${addr.detailAddress}` : ''}</p>
          {addr.deliveryMemo && (
            <div className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-[var(--soft)] px-3 py-1">
              <span className="text-[12px] text-[#7B7B7B]">{addr.deliveryMemo}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-0 pb-24">
      <Header title="배송지 관리" back={true}/>
      {/* InfoBar — Figma: #FBFBFB bg, info icon, 12px text */}
      <div className="-mx-4 mb-4 flex items-center gap-2 bg-[#FBFBFB] px-4 py-3">
        <span className="text-[11px] text-[#949494]">ℹ</span>
        <p className="text-[12px] text-[#7B7B7B]">주문 시 기본 배송지가 자동으로 선택돼요</p>
      </div>
      {addrs.length === 0 && <Empty title="등록된 배송지가 없어요" message="새 배송지를 추가해 주세요."/>}
      {defaultAddr && (
        <section className="mb-4 space-y-2">
          <p className="text-[12px] font-bold text-[#949494]">기본 배송지</p>
          <AddrCard addr={defaultAddr} isDefault={true}/>
        </section>
      )}
      {others.length > 0 && (
        <section className="space-y-0">
          <div className="flex items-center gap-1 mb-2">
            <p className="text-[12px] font-bold text-[#949494]">다른 배송지</p>
            <span className="text-[12px] font-bold text-[var(--ink)]">{others.length}</span>
          </div>
          {others.map(addr => (
            <div key={addr.addressId} className="border-b border-[#F2F2F2] py-2">
              <AddrCard addr={addr} isDefault={false}/>
            </div>
          ))}
        </section>
      )}
      {/* CTA Bar — Figma: fixed bottom black button */}
      <div className="fixed bottom-0 left-1/2 w-full max-w-[390px] -translate-x-1/2 border-t border-[var(--line)] bg-[var(--surface)] px-4 py-3">
        <button onClick={() => navigate('/addresses/new')} className="flex w-full items-center justify-center gap-2 rounded-[6px] bg-[var(--ink)] py-3 text-[15px] font-bold text-[var(--surface)]">
          + 새 배송지 추가
        </button>
      </div>
      {confirmDelete && (
        <Modal title="배송지를 삭제할까요?" onClose={() => setConfirmDelete(null)}>
          <div className="space-y-4">
            <div className="rounded-[6px] bg-[var(--soft)] p-3 space-y-1">
              <p className="text-[13px] font-semibold">{confirmDelete.recipientName} · {confirmDelete.recipientPhone}</p>
              <p className="text-[12px] text-[#7B7B7B]">{confirmDelete.postalCode ? `[${confirmDelete.postalCode}] ` : ''}{confirmDelete.roadAddress}{confirmDelete.detailAddress ? `, ${confirmDelete.detailAddress}` : ''}</p>
              {confirmDelete.deliveryMemo && <p className="text-[12px] text-[#7B7B7B]">{confirmDelete.deliveryMemo}</p>}
            </div>
            <p className="text-[12px] text-[#7B7B7B]">삭제한 배송지는 복구할 수 없어요</p>
            <div className="flex gap-2">
              <Button outline className="flex-1" onClick={() => setConfirmDelete(null)}>취소</Button>
              <Button className="flex-1" onClick={() => handleDelete(confirmDelete)}>삭제</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

const FAQ_ITEMS = [
  { category: '구매·선착순', question: '선착순 재고는 어떻게 확보하나요?', answer: '판매가 열리는 순간 결제를 먼저 완료한 순서대로 재고가 확보돼요. 장바구니에 담거나 결제 화면에 들어간 것만으로는 재고가 잡히지 않아요. 판매 30분 전 알림을 켜두고 배송지와 결제 수단을 미리 등록해 두면 더 빠르게 결제할 수 있어요.' },
  { category: '구매·선착순', question: '결제 중에 품절되면 어떻게 되나요?', answer: '재고 확보에 실패하면 결제가 진행되지 않으며 금액이 청구되지 않아요. 다음 판매 일정을 확인해 주세요.' },
  { category: '구매·선착순', question: '1인당 몇 개까지 살 수 있나요?', answer: '상품마다 계정당 구매 상한이 설정되어 있어요. 상품 상세에서 확인할 수 있습니다.' },
  { category: '구매·선착순', question: '다른 쇼핑몰보다 정말 저렴한가요?', answer: '미판매 새 상품을 정리하는 판매자가 직접 가격을 설정해요. 기존 판매처보다 저렴한 경우가 많지만, 상품마다 다를 수 있어요.' },
  { category: '배송·반품', question: '판매 알림은 언제 오나요?', answer: '판매 시작 30분 전과 시작 직후에 알림이 발송돼요. 알림 설정에서 원하는 알림을 켜거나 끌 수 있어요.' },
  { category: '결제', question: '어떤 결제 수단을 사용할 수 있나요?', answer: '신용카드·체크카드 결제를 지원합니다. 결제 수단은 마이페이지에서 미리 등록할 수 있어요.' },
  { category: '판매자', question: '판매자가 되려면 어떻게 하나요?', answer: '사업자등록증 PDF와 담당자 정보를 제출하고 운영자 승인을 받으면 판매자가 될 수 있어요.' },
];

export function FaqPage() {
  const [category, setCategory] = useState('전체');
  const categories = ['전체', '구매·선착순', '배송·반품', '결제', '판매자'];
  const filtered = category === '전체' ? FAQ_ITEMS : FAQ_ITEMS.filter(f => f.category === category);
  return (
    <div className="space-y-4">
      <Header title="자주 묻는 질문" subtitle="궁금한 내용을 검색해 보세요" back={true}/>
      <div className="divider flex gap-2 overflow-x-auto pb-2">
        {categories.map(c => (
          <button key={c} onClick={() => setCategory(c)} className={`shrink-0 rounded-[4px] px-2.5 py-1.5 text-[11px] ${category === c ? 'bg-[var(--ink)] text-[var(--surface)] font-semibold' : 'muted'}`}>{c}</button>
        ))}
      </div>
      {filtered.map((f, i) => (
        <details key={i} className="divider py-3">
          <summary className="cursor-pointer text-[13px] font-semibold"><span className="mr-2 text-[var(--muted)]">Q</span>{f.question}</summary>
          <p className="muted mt-3 text-[12px] leading-[1.8] whitespace-pre-line">{f.answer}</p>
        </details>
      ))}
      <div className="rounded-[6px] bg-[var(--blue-soft)] p-4 space-y-2">
        <p className="text-[13px] font-bold">원하는 답을 찾지 못했나요?</p>
        <div className="flex gap-2">
          <Link to="/support" className="btn btn-outline flex-1 text-[12px]">1:1 문의하기</Link>
          <Link to="/inquiries" className="btn btn-outline flex-1 text-[12px]">내 문의 내역</Link>
        </div>
      </div>
    </div>
  );
}

export function InquiryListPage() {
  const s = useStore(); const navigate = useNavigate(); const [tab, setTab] = useState<'전체' | '판매자 문의' | '1:1 문의'>('전체');
  const all = s.inquiries.filter(q => q.userId === s.activeUserId);
  const sellerCount = all.filter(q => q.sellerId !== 'stockdrop').length;
  const directCount = all.filter(q => q.sellerId === 'stockdrop').length;
  const filtered = tab === '전체' ? all : tab === '판매자 문의' ? all.filter(q => q.sellerId !== 'stockdrop') : all.filter(q => q.sellerId === 'stockdrop');
  return (
    <div className="space-y-4">
      <Header title="내 문의 내역" back={true} action={<button onClick={() => navigate('/inquiries/compose')} className="text-[12px] underline">문의 작성</button>}/>
      <div className="divider flex gap-5 pb-2">
        {([['전체', all.length], ['판매자 문의', sellerCount], ['1:1 문의', directCount]] as const).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-2 text-[11px] ${tab === t ? 'border-[var(--ink)] font-bold' : 'muted border-transparent'}`}>{t} {count}</button>
        ))}
      </div>
      {filtered.map(q => (
        <Link key={q.id} to={`/inquiries/${q.id}`} className="divider block py-4 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${q.answer ? 'bg-[#EEF8F3] text-[#3FB181]' : 'bg-[var(--soft)] text-[var(--muted)]'}`}>{q.answer ? '답변 완료' : q.sellerId === 'stockdrop' ? '접수됨' : '답변 대기'}</span>
            <span className="muted text-[10px]">{new Date(q.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }).replace('. ', '.').replace('.', '.')}{' '}{new Date(q.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
          </div>
          <p className="text-[13px] font-semibold">{q.sellerId === 'stockdrop' ? `1:1 문의 · ${q.kind}` : `판매자 문의 · ${q.kind}`}</p>
          <p className="muted truncate text-[12px]">{q.question}</p>
          <p className="text-[12px] text-[#949494]">{q.sellerId === 'stockdrop' ? 'StockDrop 운영팀' : q.productName}</p>
        </Link>
      ))}
      {!filtered.length && <Empty title="문의 내역이 없어요" message="문의 내역은 최근 1년까지 보관돼요."/>}
      {filtered.length > 0 && <p className="pb-4 text-center text-[11px] text-[#949494]">문의 내역은 최근 1년까지 보관돼요</p>}
    </div>
  );
}

export function InquiryDetailPage() {
  const { id } = useParams(); const s = useStore(); const navigate = useNavigate();
  const [replyText, setReplyText] = useState(''), [replyBusy, setReplyBusy] = useState(false);
  const toast = useToast();
  const q = s.inquiries.find(i => i.id === id && i.userId === s.activeUserId);
  if (!q) return <Empty title="문의를 찾을 수 없어요"><Link to="/inquiries" className="btn">문의 목록</Link></Empty>;
  if (q.sellerId === 'stockdrop') return <div className="space-y-5">
    <Header title="문의 상세" back={true}/>
    <div className="flex items-center justify-between"><span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${q.answer ? 'bg-[var(--positive-soft)] text-[var(--positive)]' : 'bg-[var(--blue-soft)] text-[var(--muted)]'}`}>{q.answer ? '답변 완료' : '접수됨'}</span><span className="muted text-[10px]">{q.kind} · {dateTime(q.createdAt)}</span></div>
    <div className="rounded-[6px] bg-[var(--blue-soft)] p-4 space-y-2"><p className="text-[11px] font-bold">{q.productName}</p><p className="text-[13px] leading-[1.8] whitespace-pre-line">{q.question}</p></div>
    {q.answer ? <div className="space-y-2"><p className="text-[12px] font-bold">StockDrop 운영팀 답변</p><div className="rounded-[6px] border border-[var(--line)] p-4"><p className="text-[13px] leading-[1.8] whitespace-pre-line">{q.answer}</p></div></div> : <Note title="답변 대기 중">영업일 기준 1일 내에 답변드릴게요. 2영업일 안에 답변이 없으면 StockDrop이 직접 확인합니다.</Note>}
    <div className="space-y-2"><Field label="추가 문의"><textarea aria-label="추가 문의" className="field field-box" value={replyText} onChange={e => setReplyText(e.target.value.slice(0, 1000))} placeholder="추가로 궁금한 점을 입력해 주세요" rows={4}/></Field><p className="muted text-[10px]">문의 내역은 최근 1년까지 보관돼요</p></div>
    <div className="flex gap-2"><Link className="btn btn-outline flex-1" to="/inquiries">내 문의 내역</Link><Button className="flex-1" disabled={replyBusy || !replyText.trim()} onClick={async () => { setReplyBusy(true); try { mutate(state => { const inq = state.inquiries.find(i => i.id === id); if (inq) inq.question = inq.question + '\n\n---\n' + replyText.trim(); }); setReplyText(''); toast('추가 문의가 접수되었습니다.'); } catch { toast('접수에 실패했어요. 다시 시도해 주세요.'); } finally { setReplyBusy(false); } }}>추가 문의 보내기</Button></div>
  </div>;
  return (
    <div className="space-y-5">
      <Header title="문의 상세" back={true}/>
      {/* 상품 정보 — Figma: 브랜드 · 상품명, 주문번호 */}
      <div className="space-y-0.5">
        {q.productName.includes(' · ') ? <>
          <p className="text-[15px] font-bold">{q.productName.split(' · ')[0]}</p>
          <p className="text-[13px]">{q.productName.split(' · ').slice(1).join(' · ')}{q.quantity ? ` · ${q.quantity}개` : ''}</p>
        </> : <p className="text-[15px] font-bold">{q.productName}</p>}
        {q.orderId && <p className="muted text-[12px]">주문번호 {q.orderId}</p>}
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${q.answer ? 'bg-[#EEF8F3] text-[#3FB181]' : 'bg-[var(--soft)] text-[var(--muted)]'}`}>{q.answer ? '답변 완료' : '답변 대기'}</span>
        <span className="muted text-[10px]">{q.kind} · {new Date(q.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }).replace('. ', '.').replace('.', '.')}{' '}{new Date(q.createdAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      </div>
      <div className="rounded-[6px] bg-[var(--soft)] p-4 space-y-2">
        <p className="text-[13px] leading-[1.8] whitespace-pre-line">{q.question}</p>
      </div>
      {q.answer ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[13px] font-bold">{q.productName.split(' · ')[0] ?? '판매자'} 답변</p>
            <span className="muted text-[10px]">{new Date(q.createdAt + 86400000).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' }).replace('. ', '.').replace('.', '.')}</span>
          </div>
          <div className="rounded-[6px] border border-[var(--line)] p-4 space-y-2">
            <p className="text-[13px] leading-[1.8] whitespace-pre-line">{q.answer}</p>
            {['반품', '하자', '오배송'].includes(q.kind) && <p className="muted text-[10px]">하자 확인 · 반품 배송비 판매자 부담</p>}
          </div>
          <div className="rounded-[6px] bg-[var(--soft)] p-4 space-y-1">
            <p className="text-[13px] font-semibold">답변으로 해결되지 않았나요?</p>
            <p className="muted text-[12px]">StockDrop 운영팀에 도움을 요청할 수 있어요</p>
          </div>
        </div>
      ) : (
        <Note title="답변 대기 중">판매자가 답변을 등록하면 알림으로 안내해 드릴게요.</Note>
      )}
      <div className="flex gap-2">
        <Button outline className="flex-1" onClick={() => history.back()}>추가 문의</Button>
        {q.answer && q.orderId && <Button className="flex-1" onClick={() => navigate(`/orders/${q.orderId}`)}>반품 신청하기</Button>}
      </div>
      <Link to="/inquiries" className="btn btn-outline w-full">문의 목록으로</Link>
    </div>
  );
}

export function OpsInquiryComposePage() {
  const navigate = useNavigate(); const s = useStore(); const toast = useToast();
  const [kind, setKind] = useState('계정');
  const [title, setTitle] = useState(''), [content, setContent] = useState(''), [orderId, setOrderId] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [leaving, setLeaving] = useState(false);
  const kinds = ['계정', '결제', '앱 오류', '입점·판매', '기타'];
  const dirty = !!title.trim() || !!content.trim();
  const userOrders = s.orders.filter(o => o.userId === s.activeUserId).slice(0, 10);
  return <form className="space-y-5" onSubmit={async e => { e.preventDefault(); if (!title.trim() || !content.trim()) { setError('제목과 내용을 입력해 주세요.'); return; } setBusy(true); setError(''); try { const newId = uid('q-'); await atomic(state => { state.inquiries.unshift({ id: newId, userId: state.activeUserId, sellerId: 'stockdrop', productId: '', productName: title.trim(), kind, question: content.trim(), orderId: orderId || undefined, public: false, createdAt: nowOf(state) }); }); toast('문의가 접수되었습니다. 평일 10:00–18:00 내에 답변드릴게요.'); navigate(`/inquiries/${newId}`); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
    <Header title="1:1 문의하기" action={<button type="button" onClick={() => { if (dirty) setLeaving(true); else navigate(-1); }} className="muted text-[11px]">닫기</button>}/>
    <section className="space-y-3"><p className="label">문의 유형 <span className="muted text-[10px]">· 필수</span></p><div className="flex flex-wrap gap-2">{kinds.map(k => <Chip key={k} selected={kind === k} onClick={() => setKind(k)}>{k}</Chip>)}</div></section>
    <Field label="제목" required><input aria-label="제목" className="field" value={title} onChange={e => setTitle(e.target.value)} placeholder="제목을 입력해 주세요" required/></Field>
    <Field label="문의 내용" required><textarea aria-label="문의 내용" className="field field-box" value={content} onChange={e => setContent(e.target.value.slice(0, 1000))} placeholder="문의 내용을 자세히 적어주세요." rows={5} required/><p className="muted mt-1 text-right text-[10px]">{content.length} / 1000</p></Field>
    <Field label="관련 주문"><p className="muted mb-1 text-[10px]">· 선택</p><select aria-label="관련 주문" className="field" value={orderId} onChange={e => setOrderId(e.target.value)}><option value="">주문을 선택해 주세요</option>{userOrders.map(o => <option key={o.id} value={o.id}>{o.id} · {o.product.name}</option>)}</select></Field>
    <Note>취소·반품·하자·오배송은 해당 주문의 판매자에게 문의해 주세요. 1:1 문의 운영시간 평일 10:00–18:00 · 주말·공휴일 휴무</Note>
    <ErrorBox message={error}/>
    <Button type="submit" className="w-full" disabled={busy || !title.trim() || !content.trim()}>{busy ? '접수 중…' : '문의 보내기'}</Button>
    {leaving && <ConfirmLeave onLeave={() => navigate(-1)} onStay={() => setLeaving(false)}/>}
  </form>;
}
