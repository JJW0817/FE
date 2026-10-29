import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Building2, Store, UserRound, CheckCircle2, FileText } from 'lucide-react';
import { activeUser, approveApplication, money, nowOf, uid } from '../domain';
import type { Application, DocumentFile } from '../domain';
import { atomic, mutate, useStore } from '../store';
import { dateTime } from '../hooks';
import { Badge, Button, Empty, ErrorBox, Field, Header, InfoRow, MenuRow, Modal, Note, Unavailable, useToast } from '../components/ui';
import { PdfField } from '../components/PdfField';
import { AddressModal } from './buyer';
import { LogoutButton } from './auth';
export function MyPage() {
  const s = useStore(), user = activeUser(s), navigate = useNavigate(); const app = s.applications.find(a => a.userId === user.id); const [address, setAddress] = useState(false); const toast = useToast();
  const roleLabel = user.seller ? '판매자 모드로 전환' : app?.status === 'pending' ? '판매자 승인 대기' : '판매자 입점 신청';
  return <div className="space-y-5"><Header title="구매자 마이페이지" subtitle="내 주문과 계정 정보를 관리하세요." back={false}/><div className="divider flex items-center gap-3 pb-5"><div className="grid h-[52px] w-[52px] place-items-center rounded-[4px] bg-[var(--blue-soft)] text-[18px] font-bold">{user.name[0]}</div><div className="min-w-0 flex-1"><h2 className="break-words text-[17px] font-bold">{user.name}</h2><p className="muted mt-1 break-all text-[12px]">{user.email}</p></div></div><MenuRow to="/orders" label="주문 · 배송 조회"/><section className="note space-y-3"><p className="muted text-[10px]">회원 권한</p><h2 className="text-[22px] font-bold">구매자{user.seller ? ' + 판매자' : ''}</h2><p className="muted text-[12px]">{user.seller ? '판매자 권한이 추가되었어요. 기존 구매자 권한과 구매 내역은 그대로 유지됩니다.' : app?.status === 'pending' ? '제출한 사업자등록증 PDF와 담당자 정보를 검토하고 있어요. 구매와 기존 구매 내역은 그대로 이용할 수 있어요.' : '개인·사업자 모두 구매할 수 있어요. 판매자는 사업자등록증 PDF와 담당자 정보를 제출하고 승인을 받아야 합니다.'}</p><Button className="w-full" onClick={() => { if (user.seller) { mutate(state => { state.mode = 'seller'; }); navigate('/seller'); } else navigate('/apply'); }}>{roleLabel}</Button></section><div><button onClick={() => setAddress(true)} className="divider flex h-[52px] w-full items-center justify-between"><span>배송지 관리</span><span className="muted">›</span></button><button onClick={() => navigate('/notifications/settings')} className="divider flex h-[52px] w-full items-center justify-between"><span>알림 설정</span><span className="muted">›</span></button><Link className="divider flex h-[52px] items-center justify-between" to="/support">고객 지원 <span className="muted">›</span></Link></div>{user.admin && <MenuRow to="/admin" label="운영자 · 판매자 신청 검토"/>}<LogoutButton/>{address && <AddressModal initial={s.addresses[user.id] ?? { name: user.name, phone: user.phone, address: '', detail: '', request: '' }} onClose={() => setAddress(false)} onSave={value => { mutate(state => { state.addresses[user.id] = value; }); setAddress(false); toast('배송지를 저장했습니다.'); }}/ >}</div>;
}

interface ApplicationForm { displayName: string; name: string; email: string; phone: string; bank: string; account: string; shippingAddress: string; returnAddress: string }
export function ApplicationPage() {
  const s = useStore(), user = activeUser(s), navigate = useNavigate(); const previous = s.applications.find(a => a.userId === user.id); const toast = useToast();
  const [doc, setDoc] = useState<DocumentFile | undefined>(() => { try { return JSON.parse(localStorage.getItem(`application-doc:${user.id}`) || 'null') ?? undefined; } catch { return undefined; } }); const [form, setForm] = useState<ApplicationForm>(() => { try { return JSON.parse(localStorage.getItem(`application-draft:${user.id}`) || 'null') ?? { displayName: '', name: user.name, email: user.email, phone: user.phone, bank: '신한은행', account: '', shippingAddress: '', returnAddress: '' }; } catch { return { displayName: '', name: user.name, email: user.email, phone: user.phone, bank: '신한은행', account: '', shippingAddress: '', returnAddress: '' }; } }); const [error, setError] = useState('');
  function change(key: keyof ApplicationForm, value: string) { const next = { ...form, [key]: value }; setForm(next); try { localStorage.setItem(`application-draft:${user.id}`, JSON.stringify(next)); } catch { /* Main submission still validates storage. */ } }
  if (user.seller) return <div className="space-y-5"><Header title="입점 심사"/><div className="grid grid-cols-3 gap-2 text-center text-[11px]"><span>✓ 정보 입력</span><span>✓ 입점 심사</span><b>03 판매 시작</b></div><p className="text-[10px] font-bold tracking-[1px]">WELCOME TO STOCKDROP PARTNERS</p><h1 className="text-[22px] font-bold leading-[1.5] tracking-[-1px]">{s.sellerSettings[user.id]?.displayName ?? user.name}님,<br/>입점이 승인됐어요</h1><p className="muted text-[12px] leading-relaxed">이제 남은 재고를 3시간 한정 판매로<br/>빠르게 정리할 수 있어요.</p><div className="grid grid-cols-3 gap-2 rounded-[4px] bg-[var(--blue-soft)] p-4 text-center"><div><p className="font-number text-[20px] font-bold">9.8%</p><p className="muted text-[10px]">판매 수수료</p></div><div><p className="font-number text-[20px] font-bold">D+7</p><p className="muted text-[10px]">정산 주기</p></div><div><p className="font-number text-[20px] font-bold">2영업일</p><p className="muted text-[10px]">출고 기한</p></div></div><Note title="판매 시작 전에 확인해 주세요"><p className="mb-2"><b>1</b> {'  '}첫 한정 판매 등록 — 상품, 수량, 판매 시간을 정하고 판매 심사를 요청해요</p><p className="mb-2"><b>2</b> {'  '}출고지 · 반품 주소 확인</p><p><b>3</b> {'  '}판매자 알림 설정 — 주문·출고 마감 알림을 받을 번호를 확인해요</p></Note><Button className="w-full" onClick={() => { mutate(state => { state.mode = 'seller'; }); navigate('/seller/new'); }}>첫 한정 판매 등록하기</Button><Button outline className="w-full" onClick={() => { mutate(state => { state.mode = 'seller'; }); navigate('/seller'); }}>판매자 홈으로</Button></div>;
  if (previous) return <div className="space-y-5"><Header title="입점 심사" subtitle={previous.id}/><div className="grid grid-cols-3 gap-2 text-center text-[11px]"><span>✓ 정보 입력</span><b>02 입점 심사</b><span className="muted">03 판매 시작</span></div><h1 className="text-[22px] font-bold leading-[1.5] tracking-[-1px]">입점 심사가<br/>진행 중이에요</h1><p className="muted text-[12px] leading-relaxed">영업일 기준 1~2일 안에 결과를 알림과<br/>이메일({previous.email})로 알려드려요.</p><div className="grid grid-cols-2 gap-4"><div><p className="muted text-[10px]">신청 일시</p><p className="mt-1 text-[12px] font-bold">{dateTime(previous.submittedAt)}</p></div><div><p className="muted text-[10px]">결과 안내 예정</p><p className="mt-1 text-[12px] font-bold">영업일 1~2일</p></div></div><section className="divider space-y-3 py-4"><h2 className="text-[15px] font-bold">신청 정보</h2><InfoRow label="신청 번호" value={previous.id}/><InfoRow label="판매자 표시 이름" value={previous.displayName || `${previous.name}의 스토어`}/><InfoRow label="담당자" value={`${previous.name} · ${previous.phone}`}/><PdfField value={previous.document} readOnly/><InfoRow label="정산 계좌" value={`${previous.bank} · ***${previous.account.slice(-4)}`}/><InfoRow label="출고지" value={previous.shippingAddress}/></section><Note title="심사 중에는 신청 정보를 수정할 수 없어요">변경이 필요하면 고객센터로 문의해 주세요.</Note><div className="flex gap-2"><Link className="btn btn-outline flex-1" to="/support">고객센터 문의</Link><Link className="btn flex-1" to="/">홈으로</Link></div></div>;
  const inputs: [keyof ApplicationForm, string, string?][] = [['displayName', '판매자 표시 이름 · 선택', '예: 나의 상점'], ['name', '담당자 이름'], ['email', '이메일'], ['phone', '연락처'], ['bank', '정산 은행'], ['account', '정산 계좌번호'], ['shippingAddress', '출고지'], ['returnAddress', '반품 주소']];
  return <form className="space-y-5" onSubmit={async event => { event.preventDefault(); setError(''); try { if (!doc) throw new Error('사업자등록증 PDF를 첨부해 주세요.'); if (Object.entries(form).some(([key, value]) => key !== 'displayName' && !value.trim())) throw new Error('담당자·정산·배송 정보를 모두 입력해 주세요.'); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) throw new Error('올바른 이메일 주소를 입력해 주세요.'); await atomic(state => { if (state.applications.some(a => a.userId === user.id)) throw new Error('이미 접수된 신청이 있습니다.'); state.applications.unshift({ id: uid('SD-P-'), userId: user.id, ...form, document: doc, status: 'pending', submittedAt: nowOf(state) }); }); localStorage.removeItem(`application-draft:${user.id}`); localStorage.removeItem(`application-doc:${user.id}`); toast('판매자 신청이 접수되었습니다.'); } catch (e) { setError((e as Error).message); } }}><Header title="판매자 입점 신청" subtitle="1인 쇼핑몰 개인사업자를 위한 판매자 신청"/><div className="flex gap-4 bg-[var(--hero)] p-5"><div className="flex-1"><p className="text-[9px] font-bold tracking-[1px]">STOCKDROP PARTNERS</p><h2 className="mt-3 text-[22px] font-bold leading-[1.5] tracking-[-1px]">혼자 운영하는 쇼핑몰,<br/>남은 재고를 새 기회로.</h2><p className="muted mt-3 text-[11px] leading-relaxed">사업자등록증을 첨부하고<br/>판매자로 신청해 보세요.</p></div><Store size={52} strokeWidth={1} className="self-center text-[var(--muted)]"/></div><div className="divider grid grid-cols-3 gap-2 pb-5 text-center text-[11px]"><b>01 정보 입력</b><span className="muted">02 입점 심사</span><span className="muted">03 판매 시작</span></div><PdfField value={doc} onChange={file => { setDoc(file); try { if (file) localStorage.setItem(`application-doc:${user.id}`, JSON.stringify(file)); else localStorage.removeItem(`application-doc:${user.id}`); } catch { setError('파일 정보를 저장하지 못했습니다. 브라우저 저장 공간을 확인해 주세요.'); } }}/>{inputs.map(([key, label, placeholder]) => <Field key={key} label={label} required={key !== 'displayName'}><input aria-label={label} required={key !== 'displayName'} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} value={form[key]} onChange={e => change(key, e.target.value)} placeholder={placeholder} className="field"/></Field>)}<Note title="사업자등록증 검토 안내">사업자등록증 PDF와 담당자 정보를 확인한 뒤 승인 결과를 안내합니다.</Note><ErrorBox message={error}/><Button className="w-full" type="submit" disabled={!doc}>입점 심사 요청하기</Button></form>;
}

export function AdminListPage() {
  const s = useStore(), user = activeUser(s); const [tab, setTab] = useState<'pending' | 'approved'>('pending');
  if (!user.admin) return <Unavailable message="운영자만 사용할 수 있습니다."/>;
  const apps = s.applications.filter(a => a.status === tab).sort((a, b) => a.submittedAt - b.submittedAt);
  return <><Header title="판매자 신청 검토" subtitle="운영자 전용 · 제출 정보를 확인하고 승인해 주세요." back={false}/><div className="divider mb-3 flex gap-5">{(['pending', 'approved'] as const).map(t => <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-3 text-[13px] ${tab === t ? 'border-[var(--ink)] font-bold' : 'muted border-transparent'}`}>{t === 'pending' ? '심사 대기' : '승인 완료'} {s.applications.filter(a => a.status === t).length}건</button>)}</div>{apps.map(app => <Link key={app.id} to={`/admin/${app.id}`} className="divider block space-y-3 py-5"><div className="flex justify-between text-[10px]"><span className="muted">{dateTime(app.submittedAt)} 접수</span><Badge live={app.status === 'approved'}>{app.status === 'pending' ? '심사 대기' : '승인 완료'}</Badge></div><div className="flex items-center gap-3"><div className="grid h-11 w-11 place-items-center rounded-[4px] bg-[var(--blue-soft)]"><Store size={22} className="muted"/></div><div className="min-w-0 flex-1"><h2 className="text-[15px] font-bold">{app.displayName || `${app.name}의 스토어`}</h2><p className="muted mt-1 text-[11px]">{app.name} · 개인사업자</p></div><span className="muted">›</span></div><p className="muted truncate text-[10px]">{app.id} · 신청 정보 보기</p></Link>)}{!apps.length && <Empty title={tab === 'pending' ? '심사 대기 중인 신청이 없어요' : '승인한 신청이 없어요'}/>}<div className="mt-8"><Note title="첨부된 사업자등록증 PDF를 검토합니다.">신청 상세에서 사업자등록증 PDF와 담당자 정보를 확인한 뒤 승인해 주세요.</Note></div></>;
}
export function AdminDetailPage() {
  const { id } = useParams(); const s = useStore(), user = activeUser(s); const app = s.applications.find(a => a.id === id); const [viewed, setViewed] = useState(false), [confirm, setConfirm] = useState(false), [error, setError] = useState(''), [busy, setBusy] = useState(false); const toast = useToast();
  if (!user.admin) return <Unavailable message="운영자만 사용할 수 있습니다."/>;
  if (!app) return <Empty title="신청 정보를 찾을 수 없어요"/>;
  return <div className="space-y-5"><Header title={app.status === 'approved' ? '판매자 승인 완료' : '판매자 신청 검토'} subtitle={app.id}/><Note green={app.status === 'approved'} title={app.status === 'approved' ? '판매자 권한 추가 완료' : `${app.name} · ${app.displayName || '판매자 신청'}`}>{app.status === 'approved' ? `승인 일시 ${dateTime(app.approvedAt!)} · 처리자 운영자` : '제출 정보 · 읽기 전용'}</Note><PdfField value={app.document} readOnly onViewed={() => setViewed(true)}/><section className="space-y-3"><h2 className="text-[15px] font-bold">담당자 정보</h2><InfoRow label="이름" value={app.name}/><InfoRow label="이메일" value={app.email}/><InfoRow label="연락처" value={app.phone}/></section><section className="divider space-y-3 py-4"><h2 className="text-[15px] font-bold">정산 · 배송 정보</h2><InfoRow label="정산계좌" value={`${app.bank} · ***${app.account.slice(-4)}`}/><InfoRow label="출고지" value={app.shippingAddress}/><InfoRow label="반품 주소" value={app.returnAddress}/></section><Note title={app.status === 'approved' ? '승인 결과' : '제출 정보 수동 검토'}>{app.status === 'approved' ? '판매자 권한이 추가되었으며 기존 구매 권한과 내역은 그대로 유지됩니다.' : '첨부된 사업자등록증 PDF와 담당자 정보를 확인한 뒤 승인해 주세요. 승인하면 판매자 권한이 추가됩니다.'}</Note><ErrorBox message={error}/>{app.status === 'approved' ? <Link className="btn w-full" to="/admin">신청 목록으로</Link> : <><Button className="w-full" disabled={!viewed} onClick={() => setConfirm(true)}>판매자 승인</Button>{!viewed && <p className="muted text-center text-[10px]">사업자등록증 PDF를 먼저 열어 확인해 주세요.</p>}</>}{confirm && <Modal title="판매자로 승인할까요?" onClose={() => !busy && setConfirm(false)}><div className="space-y-5"><p className="muted text-[12px]">첨부된 PDF와 신청 정보를 검토했는지 확인해 주세요.</p><Note><InfoRow label="신청자" value={app.name}/><InfoRow label="판매자 표시 이름" value={app.displayName || `${app.name}의 스토어`}/><InfoRow label="제출 서류" value="사업자등록증 PDF 1개"/></Note><p className="text-[12px] leading-relaxed">승인하면 판매자 권한이 추가됩니다.<br/>기존 구매자 권한과 구매 내역은 유지됩니다.</p><div className="flex gap-2"><Button outline className="w-[86px]" onClick={() => setConfirm(false)} disabled={busy}>취소</Button><Button className="flex-1" disabled={busy} onClick={async () => { setBusy(true); try { await atomic(state => approveApplication(state, state.activeUserId, app.id, nowOf(state))); setConfirm(false); toast('판매자로 승인했습니다.'); } catch (e) { setError((e as Error).message); setConfirm(false); } finally { setBusy(false); } }}>{busy ? '승인 중…' : '승인하기'}</Button></div></div></Modal>}</div>;
}
export function SupportPage() {
  const s = useStore(); const [tab, setTab] = useState('전체'); const faqTabs = ['전체', '구매·선착순', '배송·반품', '결제', '판매자'];
  const recentOrder = s.orders.filter(o => o.userId === s.activeUserId).sort((a, b) => b.createdAt - a.createdAt)[0];
  const faqs: [string, string, string][] = [['구매·선착순', '선착순 재고는 어떻게 확보하나요?', '판매가 열리는 순간 결제를 먼저 완료한 순서대로 재고가 확보돼요. 장바구니에 담거나 결제 화면에 들어간 것만으로는 재고가 잡히지 않아요. 판매 30분 전 알림을 켜두고 배송지와 결제 수단을 미리 등록해 두면 더 빠르게 결제할 수 있어요.'], ['구매·선착순', '결제 중에 품절되면 어떻게 되나요?', '재고 확보에 실패하면 결제가 진행되지 않으며 금액이 청구되지 않아요. 다음 판매 일정을 확인해 주세요.'], ['구매·선착순', '1인당 몇 개까지 살 수 있나요?', '상품마다 계정당 구매 상한이 설정되어 있어요. 상품 상세에서 확인할 수 있습니다.'], ['구매·선착순', '다른 쇼핑몰보다 정말 저렴한가요?', '미판매 새 상품을 정리하는 판매자가 직접 가격을 설정해요. 기존 판매처보다 저렴한 경우가 많지만, 상품마다 다를 수 있어요.'], ['배송·반품', '판매 알림은 언제 오나요?', '판매 시작 30분 전과 시작 직후에 알림이 발송돼요. 알림 설정에서 원하는 알림을 켜거나 끌 수 있어요.'], ['결제', '어떤 결제 수단을 사용할 수 있나요?', '신용카드·체크카드 결제를 지원합니다. 결제 수단은 마이페이지에서 미리 등록할 수 있어요.'], ['판매자', '판매자가 되려면 어떻게 하나요?', '사업자등록증 PDF와 담당자 정보를 제출하고 운영자 승인을 받으면 판매자가 될 수 있어요.']];
  const filtered = faqs.filter(([cat]) => tab === '전체' || cat === tab);
  return <div className="space-y-5"><Header title="고객 지원"/><p className="muted text-[12px]">궁금한 내용을 검색해 보세요</p>{recentOrder && <section className="divider space-y-3 pb-4"><h2 className="text-[15px] font-bold">주문 관련 문의</h2><Link to={`/orders/${recentOrder.id}`} className="block space-y-2 rounded-[4px] bg-[var(--blue-soft)] p-3"><p className="muted text-[10px]">전체 주문</p><p className="text-[12px] font-bold">{recentOrder.product.name}</p><p className="muted text-[10px]">{dateTime(recentOrder.createdAt)} 결제 · {money(recentOrder.total)}</p></Link><Link className="btn btn-outline w-full" to={`/orders/${recentOrder.id}`}>이 주문 판매자에게 문의</Link><p className="muted text-[10px]">취소·반품·하자·오배송은 해당 주문의 판매자에게 전달돼요.</p></section>}<section className="space-y-3"><h2 className="text-[15px] font-bold">자주 묻는 질문</h2><div className="divider flex gap-2 pb-3">{faqTabs.map(t => <button key={t} onClick={() => setTab(t)} className={`rounded-[4px] px-2.5 py-1.5 text-[11px] ${tab === t ? 'bg-[var(--ink)] font-semibold text-[var(--surface)]' : 'muted'}`}>{t}</button>)}</div>{filtered.map(([, q, a], i) => <details key={i} className="divider py-4"><summary className="font-bold">Q {'  '}{q}</summary><p className="muted mt-3 text-[12px] leading-relaxed">{a}</p></details>)}</section><section className="divider space-y-3 py-4"><h2 className="text-[15px] font-bold">1:1 문의하기</h2><p className="muted text-[12px]">계정·결제·앱 오류</p><Link className="btn btn-outline w-full" to="/inquiries">내 문의 내역</Link><p className="muted text-[10px]">1:1 문의 운영시간 평일 10:00–18:00 · 주말·공휴일 휴무</p></section></div>;
}

export function AddressManagePage() {
  const s = useStore(); const user = activeUser(s); const toast = useToast();
  const address = s.addresses[user.id];
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="space-y-5">
      <Header title="배송지 관리" subtitle="주문 시 기본 배송지가 자동으로 선택돼요" back={true}/>
      {address ? (
        <>
        <section className="space-y-3">
          <h2 className="text-[14px] font-bold">기본 배송지</h2>
          <div className="rounded-[6px] border border-[var(--line)] p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-semibold">{(address as any).label || '집'}</p>
              <div className="flex gap-3">
                <button onClick={() => setEditing(true)} className="text-[12px] underline">수정</button>
                <button onClick={() => setConfirmDelete(true)} className="text-[12px] text-[var(--red)] underline">삭제</button>
              </div>
            </div>
            <p className="text-[12px]">{address.name} · {address.phone}</p>
            <p className="muted text-[12px] leading-relaxed">{address.address}{address.detail ? `, ${address.detail}` : ''}</p>
            {address.request && <p className="muted text-[11px]">{address.request}</p>}
          </div>
        </section>
        </>
      ) : (
        <Empty title="등록된 배송지가 없어요" message="새 배송지를 추가해 주세요."/>
      )}
      <Button outline className="w-full" onClick={() => setEditing(true)}>
        {address ? '새 배송지 추가' : '새 배송지 추가'}
      </Button>
      {editing && (
        <AddressModal
          initial={address ?? { name: user.name, phone: user.phone, address: '', detail: '', request: '' }}
          onClose={() => setEditing(false)}
          onSave={value => { mutate(state => { state.addresses[user.id] = value; }); setEditing(false); toast('배송지를 저장했습니다.'); }}
        />
      )}
      {confirmDelete && (
        <Modal title="배송지를 삭제할까요?" onClose={() => setConfirmDelete(false)}>
          <div className="space-y-4">
            <p className="muted text-[12px]">삭제한 배송지는 복구할 수 없어요</p>
            {address && <div className="rounded-[4px] bg-[var(--blue-soft)] p-3 space-y-1">
              <p className="text-[12px] font-semibold">{(address as any).label || '집'}</p>
              <p className="muted text-[11px]">{address.address}{address.detail ? `, ${address.detail}` : ''}</p>
            </div>}
            <div className="flex gap-2">
              <Button outline className="flex-1" onClick={() => setConfirmDelete(false)}>취소</Button>
              <Button className="flex-1" onClick={() => { mutate(state => { delete state.addresses[user.id]; }); setConfirmDelete(false); toast('배송지를 삭제했습니다.'); }}>삭제</Button>
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
  const s = useStore(); const [tab, setTab] = useState<'전체' | '판매자 문의' | '1:1 문의'>('전체');
  const all = s.inquiries.filter(q => q.userId === s.activeUserId);
  const sellerCount = all.filter(q => q.sellerId !== 'stockdrop').length;
  const directCount = all.filter(q => q.sellerId === 'stockdrop').length;
  const filtered = tab === '전체' ? all : tab === '판매자 문의' ? all.filter(q => q.sellerId !== 'stockdrop') : all.filter(q => q.sellerId === 'stockdrop');
  return (
    <div className="space-y-4">
      <Header title="내 문의 내역" back={true}/>
      <div className="divider flex gap-5 pb-2">
        {([['전체', all.length], ['판매자 문의', sellerCount], ['1:1 문의', directCount]] as const).map(([t, count]) => (
          <button key={t} onClick={() => setTab(t)} className={`border-b-2 py-2 text-[11px] ${tab === t ? 'border-[var(--ink)] font-bold' : 'muted border-transparent'}`}>{t} {count}</button>
        ))}
      </div>
      {filtered.map(q => (
        <Link key={q.id} to={`/inquiries/${q.id}`} className="divider block py-4 space-y-1">
          <div className="flex items-center justify-between">
            <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${q.answer ? 'bg-[var(--green)] text-white' : 'bg-[var(--blue-soft)] text-[var(--muted)]'}`}>{q.answer ? '답변 완료' : '답변 대기'}</span>
            <span className="muted text-[10px]">{new Date(q.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })}</span>
          </div>
          <p className="text-[12px] font-semibold">{q.kind} · {q.productName}</p>
          <p className="muted truncate text-[12px]">{q.question}</p>
        </Link>
      ))}
      {!filtered.length && <Empty title="문의 내역이 없어요" message="문의 내역은 최근 1년까지 보관돼요."/>}
    </div>
  );
}

export function InquiryDetailPage() {
  const { id } = useParams(); const s = useStore();
  const q = s.inquiries.find(i => i.id === id && i.userId === s.activeUserId);
  if (!q) return <Empty title="문의를 찾을 수 없어요"><Link to="/inquiries" className="btn">문의 목록</Link></Empty>;
  return (
    <div className="space-y-5">
      <Header title="문의 상세" back={true}/>
      <div className="space-y-1">
        <p className="text-[12px] font-bold">{q.productName}</p>
        {q.orderId && <p className="muted text-[11px]">주문번호 {q.orderId}</p>}
      </div>
      <div className="flex items-center justify-between">
        <span className={`rounded px-2 py-0.5 text-[10px] font-semibold ${q.answer ? 'bg-[var(--green)] text-white' : 'bg-[var(--blue-soft)] text-[var(--muted)]'}`}>{q.answer ? '답변 완료' : '답변 대기'}</span>
        <span className="muted text-[10px]">{q.kind} · {new Date(q.createdAt).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })}</span>
      </div>
      <div className="rounded-[6px] bg-[var(--blue-soft)] p-4 space-y-2">
        <p className="text-[11px] font-semibold text-[var(--muted)]">문의 내용</p>
        <p className="text-[13px] leading-[1.8] whitespace-pre-line">{q.question}</p>
      </div>
      {q.answer ? (
        <div className="space-y-2">
          <p className="text-[12px] font-bold">판매자 답변</p>
          <div className="rounded-[6px] border border-[var(--line)] p-4 space-y-2">
            <p className="text-[13px] leading-[1.8] whitespace-pre-line">{q.answer}</p>
            <p className="muted text-[10px]">하자 확인 · 반품 배송비 판매자 부담</p>
          </div>
          <Note>답변으로 해결되지 않았나요? StockDrop 운영팀에 도움을 요청할 수 있어요.</Note>
        </div>
      ) : (
        <Note title="답변 대기 중">판매자가 답변을 등록하면 알림으로 안내해 드릴게요.</Note>
      )}
      <div className="flex gap-2">
        <Button outline className="flex-1" onClick={() => history.back()}>추가 문의</Button>
        {q.answer && <Button className="flex-1">반품 신청하기</Button>}
      </div>
      <Link to="/inquiries" className="btn btn-outline w-full">문의 목록으로</Link>
    </div>
  );
}
