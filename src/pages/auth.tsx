import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Bell, Check, Eye, EyeOff, PackageCheck, Package, Tag, ShieldCheck } from 'lucide-react';
import { Button, ErrorBox, Field, Header, Modal, Note, useToast } from '../components/ui';
import { getState, mutate, useStore } from '../store';
import { initialAuth } from '../domain';
import { apiGet, apiPut } from '../api';
import { login, logout, normalizeEmail, resetPassword, safeNext, sendCode, signedIn, signup, validEmail, validPassword, verifyCode, demoLogin } from '../auth';
import { DEMO_ACCOUNTS, DEMO_LOGIN } from '../config';
import { requestPushPermission } from '../firebase';
const inputClass = 'w-full min-w-0 border-0 border-b border-[var(--line)] bg-transparent py-3 text-[14px] outline-none placeholder:text-[var(--muted)] focus:border-[var(--ink)] disabled:opacity-50';
function useAuthNow() { const [now, setNow] = useState(Date.now()); useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []); return now; }
const DEMO_NEXT_KEY = 'stockdrop:demo-next';
function useNext() { const [params] = useSearchParams(); return safeNext(params.get('next')); }
function markOnboarded() { mutate(s => { (s.auth ??= initialAuth()).onboarded = true; }); if (!location.hash.startsWith('#/onboarding')) sessionStorage.setItem('stockdrop:guest-session', '1'); }
function Wordmark() { return <div className="py-8 text-center"><p className="text-[38px] font-black italic tracking-[-2px]">STOCKDROP</p><p className="muted mt-1 text-[11px] tracking-[2px]">NEW FINDS. LIMITED TIME.</p></div>; }
function AuthShell({ title, children, onBack }: { title: string; children: ReactNode; onBack?: () => void }) { return <div className="min-h-[calc(100dvh-60px)] pb-8">{onBack ? <header className="divider mb-5 flex min-h-[50px] items-center gap-3 pb-3"><button aria-label="이전 화면" onClick={onBack} className="-ml-1 grid h-9 w-9 place-items-center"><ArrowLeft size={20}/></button><h1 className="text-[18px] font-bold tracking-[-.5px]">{title}</h1></header> : <Header title={title}/>}<Wordmark/>{children}</div>; }
function PasswordField({ label = '비밀번호', value, onChange, autoComplete = 'new-password', placeholder = '영문·숫자·특수문자 8~32자' }: { label?: string; value: string; onChange: (v: string) => void; autoComplete?: string; placeholder?: string }) { const [visible, setVisible] = useState(false); return <Field label={label} required><div className="relative"><input aria-label={label} type={visible ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} autoComplete={autoComplete} maxLength={32} placeholder={placeholder} className={`${inputClass} pr-10`}/><button type="button" aria-label={`${label} ${visible ? '숨기기' : '보기'}`} onClick={() => setVisible(!visible)} className="absolute right-0 top-1 grid h-10 w-10 place-items-center text-[var(--muted)]">{visible ? <EyeOff size={18}/> : <Eye size={18}/>}</button></div></Field>; }
export function OnboardingPage() {
  const [step, setStep] = useState(0), navigate = useNavigate(), next = useNext();
  const slides = [ { tag: 'NEW FINDS', title: <>남은 새 상품,<br/>새로운 발견.</>, text: '쇼핑몰에서 팔리지 않은 새 상품을\n3시간 동안만 특별한 가격에 만나 보세요.', image: './images/onboarding-hero.jpg' }, { tag: 'JUST 3 HOURS', title: <>기회는 짧게,<br/>선택은 확실하게.</>, text: '판매는 시작부터 단 3시간.\n구매하기로 재고를 확보한 뒤 5분 안에 결제해요.', image: './images/generated-5.png' }, { tag: 'ONE ACCOUNT', title: <>사고, 팔고.\n하나의 계정으로.</>, text: '누구나 구매자로 시작해요. 판매를 원한다면\n사업자등록증 PDF 제출 후 승인을 받아 주세요.', image: './images/generated-4.png' } ];
  const slide = slides[step]; const finish = (path: string) => { markOnboarded(); navigate(path === next ? `/welcome?next=${encodeURIComponent(next)}` : path, { replace: true }); };
  return <div className="flex min-h-[calc(100dvh-60px)] flex-col"><header className="flex items-center justify-between py-3"><span className="text-[17px] font-black italic tracking-[-.8px]">STOCKDROP</span><button className="muted py-2 text-[12px]" onClick={() => finish(next)}>건너뛰기</button></header><div className="-mx-4 mt-3 bg-[var(--blue-soft)]"><img src={slide.image} alt={['미판매 새 상품 가디건', '문구 상품 노트', '패션잡화 에코백'][step]} className="aspect-[1.3] w-full object-cover"/></div><div aria-live="polite" className="flex-1 pb-6 pt-7"><p className="text-[10px] font-bold tracking-[2px]">{slide.tag}</p><h1 className="mt-3 text-[32px] font-bold leading-[1.35] tracking-[-1.4px]">{slide.title}</h1><p className="muted mt-4 whitespace-pre-line text-[12px] leading-[1.9]">{slide.text}</p></div><div className="flex items-center justify-between pb-6"><div aria-label="온보딩 단계" className="flex gap-2">{slides.map((_, i) => <button key={i} aria-label={`안내 ${i + 1}단계`} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)} className={`h-1.5 rounded-full ${i === step ? 'w-5 bg-[var(--ink)]' : 'w-1.5 bg-[var(--line)]'}`}/>)}</div><span className="muted text-[10px]">0{step + 1} / 03</span></div><div className="flex gap-3 pb-4">{step > 0 && <Button outline aria-label="이전 안내" className="w-14" onClick={() => setStep(step - 1)}><ArrowLeft size={18}/></Button>}<Button className="flex-1" onClick={() => step < 2 ? setStep(step + 1) : finish(`/welcome?next=${encodeURIComponent(next)}`)}>{step < 2 ? '다음' : '시작하기'}<ArrowRight size={17}/></Button></div></div>;
}
export function WelcomePage() { const next = useNext(), navigate = useNavigate(), s = useStore(); if (signedIn(s)) return <Navigate to={next} replace/>; return <div className="flex min-h-[calc(100dvh-60px)] flex-col"><Wordmark/><div className="-mx-4 bg-[var(--blue-soft)]"><img alt="새로운 발견을 기다리는 에코백" src="./images/welcome-hero.jpg" className="aspect-[1.4] w-full object-cover"/></div><div className="pt-7"><h1 className="text-[28px] font-bold leading-[1.45] tracking-[-1px]">새로운 발견의 시작.</h1><p className="muted mt-3 text-[12px] leading-relaxed">마음에 드는 새 상품을 발견하고,<br/>정해진 시간에 특별한 기회를 잡아 보세요.</p></div><div className="my-5">{[{ icon: <PackageCheck size={17}/>, title: '100% 새 상품', desc: '미개봉 · 미사용 재고' }, { icon: <Package size={17}/>, title: '벌크 판매', desc: '대량 재고를 한 번에' }, { icon: <Tag size={17}/>, title: '저렴한 가격', desc: '정가보다 훨씬 싸게' }].map((item, i) => <div key={i} className="divider flex items-center gap-3 py-3.5"><span className="muted">{item.icon}</span><div className="flex-1"><span className="text-[12px] font-semibold">{item.title}</span><span className="muted mx-2 text-[11px]">·</span><span className="muted text-[11px]">{item.desc}</span></div></div>)}</div><div className="space-y-3 pb-6 pt-2"><Link className="btn w-full" to={`/signup?next=${encodeURIComponent(next)}`}>이메일로 회원가입</Link><Link className="btn btn-outline w-full" to={`/login?next=${encodeURIComponent(next)}`}>이메일로 로그인</Link><button className="muted w-full py-3 text-[12px] underline underline-offset-4" onClick={() => { markOnboarded(); navigate(next, { replace: true }); }}>가입 없이 둘러보기</button></div></div>; }
export function LoginPage() {
  const s = useStore(), next = useNext(), navigate = useNavigate(); const [email, setEmail] = useState(''), [password, setPassword] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  // 데모 계정 버튼으로 고른 시작 화면(판매자 → /seller, 운영자 → /admin). 로그인 전 화면에 다시 들어오면 지운다
  useEffect(() => { if (!signedIn(getState())) sessionStorage.removeItem(DEMO_NEXT_KEY); }, []);
  if (signedIn(s)) return <Navigate to={sessionStorage.getItem(DEMO_NEXT_KEY) || next} replace/>;
  return <AuthShell title="로그인"><form className="space-y-6" onSubmit={async e => { e.preventDefault(); if (busy) return; setBusy(true); setError(''); try { await login(email, password); navigate(next, { replace: true }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}><Field label="이메일" required><input aria-label="이메일" autoComplete="username" autoCapitalize="none" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="예: stockdrop@example.com" className={inputClass}/></Field><PasswordField value={password} onChange={setPassword} autoComplete="current-password"/><ErrorBox message={error}/><Button type="submit" className="w-full" disabled={busy || !validEmail(email) || !password}>{busy ? '로그인 중…' : '로그인'}</Button></form><div className="mt-5 flex items-center justify-center gap-5 text-[12px]"><Link to={`/signup?next=${encodeURIComponent(next)}`}>이메일 회원가입</Link><span className="text-[var(--line)]">|</span><Link to={`/reset-password?next=${encodeURIComponent(next)}`}>비밀번호 재설정</Link></div>{DEMO_LOGIN && <div className="mt-8 rounded-[6px] bg-[var(--soft)] p-4"><p className="text-[12px] font-bold">미리보기 계정 · 백엔드 연동 전</p><p className="muted mt-1 text-[11px]">서버 없이 목업 데이터로 화면을 확인해요.</p><div className="mt-3 grid grid-cols-3 gap-2">{DEMO_ACCOUNTS.map(a => <Button key={a.id} outline className="min-h-10! px-2 text-[12px]!" onClick={() => { sessionStorage.setItem(DEMO_NEXT_KEY, a.id === 'seller' ? '/seller' : a.id === 'admin' ? '/admin' : next); demoLogin(a.id); }}>{a.label}로 보기</Button>)}</div></div>}<div className="mt-12 border-t border-[var(--line)] pt-6"><p className="muted text-center text-[11px]">하나의 계정으로 구매하고, 승인 후 판매까지.</p><button className="muted mt-5 w-full py-2 text-[12px] underline underline-offset-4" onClick={() => { markOnboarded(); navigate('/'); }}>상품 먼저 둘러보기</button></div></AuthShell>;
}
function EmailVerification({ email, setEmail, purpose, onError }: { email: string; setEmail: (v: string) => void; purpose: 'signup' | 'reset'; onError: (v: string) => void }) {
  const s = useStore(), c = s.auth?.challenges[`${purpose}:${normalizeEmail(email)}`]; const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now()), [codeError, setCodeError] = useState('');
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const verified = !!c?.verified && c.expiresAt > now, remain = Math.max(0, Math.ceil(((c?.expiresAt ?? now) - now) / 1000)), cooldown = c ? Math.max(0, Math.ceil((c.sentAt + 60000 - now) / 1000)) : 0;
  const remainLabel = remain ? `${Math.floor(remain / 60).toString().padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}` : '';
  return <div className="space-y-5">
    <Field label="이메일" required><div className="flex items-center gap-3"><input aria-label="이메일" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={e => { setEmail(e.target.value); setCode(''); onError(''); setCodeError(''); }} placeholder="가입할 이메일 주소" className={`${inputClass} flex-1`}/><Button outline className="min-h-9! shrink-0 px-3 text-[11px]!" disabled={busy || !validEmail(email) || cooldown > 0 || verified} onClick={async () => { setBusy(true); onError(''); try { await sendCode(email, purpose); setNow(Date.now()); setCode(''); setCodeError(''); } catch (e) { onError((e as Error).message); } finally { setBusy(false); } }}>{verified ? '인증 완료' : cooldown ? `재요청 ${cooldown}초` : c ? '다시 요청' : '인증번호 요청'}</Button></div></Field>
    {c && !verified && <>
      <p className="text-[13px] text-[var(--muted)]">입력하신 이메일로 인증번호를 보냈어요.<br/>{email}</p>
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="text-[13px] font-bold">인증번호</span><span className="text-[11px] text-[var(--muted)]">· 필수</span></div>
          {remainLabel && <span className="text-[12px] font-bold text-[var(--red)]">{remainLabel}</span>}
        </div>
        <div className="flex gap-1.5 py-3">
          {[0,1,2,3,4,5].map(i => <div key={i} className={`flex h-[55px] flex-1 items-center justify-center rounded-[4px] border text-[22px] font-bold ${codeError ? 'border-[var(--red)]' : code.length > i ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}>{code[i] ?? ''}</div>)}
        </div>
        {/* hidden real input for keyboard input */}
        <input aria-label="이메일 인증번호" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setCodeError(''); }} className="sr-only"/>
        {codeError && <p className="text-[12px] text-[var(--red)]">인증번호가 일치하지 않아요.</p>}
        {!remain && <p className="text-[12px] text-[var(--muted)]">인증 시간이 지났어요. 다시 요청해 주세요.</p>}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[12px] text-[var(--muted)]">메일을 받지 못했나요?</span>
        <Button outline className="min-h-9! px-3 text-[11px]!" disabled={cooldown > 0} onClick={async () => { setBusy(true); onError(''); try { await sendCode(email, purpose); setNow(Date.now()); setCode(''); setCodeError(''); } catch (e) { onError((e as Error).message); } finally { setBusy(false); } }}>{cooldown ? `재전송 (${cooldown}초 후 활성화)` : '재전송'}</Button>
      </div>
      <div className="rounded-[4px] bg-[var(--blue-soft)] px-4 py-3 text-[12px] text-[var(--muted)]">
        인증번호는 3분 동안 유효해요. 메일이 보이지 않으면 스팸함도 확인해 주세요.
      </div>
      {/* invisible submit button to allow verify on code complete */}
      {code.length === 6 && remain > 0 && <Button outline className="w-full" disabled={busy} onClick={async () => { setBusy(true); onError(''); setCodeError(''); try { const error = await verifyCode(email, purpose, code); if (error) { setCodeError(error); onError(error); setCode(''); } } catch (e) { setCodeError((e as Error).message); onError((e as Error).message); } finally { setBusy(false); } }}>인증 확인</Button>}
    </>}
    {verified && <p role="status" className="flex items-center gap-2 text-[12px] text-[var(--green)]"><ShieldCheck size={15}/>이메일 인증이 완료되었어요.</p>}
  </div>;
}
export function LegalContent({ kind }: { kind: string }) { return <div className="space-y-5 text-[12px] leading-[1.9]"><p className="text-[10px] font-bold tracking-[1px]">STOCKDROP · {kind === 'privacy' ? 'PRIVACY' : 'TERMS'}</p>{kind === 'privacy' ? <><h2 className="font-bold">개인정보 수집·이용 안내</h2><p>계정 생성과 로그인, 주문·배송, 문의 응대를 위해 이메일·이름·연락처를 이용합니다. 배송지는 주문 시 별도로 입력합니다.</p><p>판매자 신청 시 사업자등록증 PDF, 담당자 정보, 정산·출고·반품 정보를 추가로 수집합니다. 판매자 승인은 제출 서류 검토 후 진행됩니다.</p><p>주문 이행에 필요한 수령인·연락처·배송지는 해당 주문의 판매자에게 제공됩니다. 주문 문의의 개인정보는 공개 FAQ로 게시하지 않습니다.</p><p>수집 목적이 달성되면 정보를 삭제하며, 관련 법령상 보관이 필요한 거래 정보는 해당 기간 보관합니다.</p><p>필수 정보 수집에 동의하지 않을 수 있으나 회원가입과 거래 이용이 제한됩니다.</p></> : <><h2 className="text-[15px] font-bold">서비스 이용 안내</h2><p className="muted">STOCKDROP을 이용하기 전에 꼭 알아두실 내용이에요.</p><div className="grid grid-cols-3 gap-2 rounded-[4px] bg-[var(--blue-soft)] p-4 text-center"><div><p className="font-number text-[20px] font-bold">3시간</p><p className="muted text-[10px]">판매 진행 시간</p></div><div><p className="font-number text-[20px] font-bold">5분</p><p className="muted text-[10px]">확보 후 결제 기한</p></div><div><p className="font-number text-[20px] font-bold">새 상품</p><p className="muted text-[10px]">거래 대상</p></div></div><section className="space-y-4"><h3 className="font-bold">01 {'  '}회원 및 판매자 자격</h3><p>회원은 구매자로 시작하며, 판매는 사업자등록증 PDF 제출 및 운영자 승인 후 가능합니다. 판매자 승인 후에도 구매 권한과 기존 내역은 유지됩니다.</p><h3 className="font-bold">02 {'  '}거래 가능 상품</h3><p>의류·패션잡화·문구·일반 생활잡화의 미판매 새 상품을 거래합니다. 중고·전시·하자 상품과 식품·건강기능식품·화장품·전기제품은 지원하지 않습니다.</p><h3 className="font-bold">03 {'  '}판매 시간과 결제</h3><p>판매는 시작 후 3시간입니다. 옵션 선택만으로 재고가 확보되지 않으며, 구매하기로 확보에 성공한 뒤 5분 안에 결제해야 합니다. 결제 결과 확인 중인 재고는 결과가 확정되기 전 반환되지 않습니다.</p><h3 className="font-bold">04 {'  '}취소 · 반품 · 오배송</h3><p>취소·반품·하자·오배송은 주문 상세에서 판매자에게 문의합니다. 법령상 소비자의 권리는 별도로 보장됩니다.</p><h3 className="font-bold">05 {'  '}배송완료 처리</h3><p>판매자의 수동 배송완료 처리는 구매확정이나 정산 송금을 의미하지 않습니다.</p></section></>}</div>; }
export function LegalPage() { const [params] = useSearchParams(); const kind = params.get('kind') || 'terms'; return <><Header title={kind === 'privacy' ? '개인정보 수집·이용' : '서비스 이용약관'}/><LegalContent kind={kind}/></>; }
/** 회원가입 1단계: 이름 + 이메일 인증 → /signup/info 로 이동 */
export function SignupPage() {
  const s = useStore(), next = useNext(), navigate = useNavigate();
  const [email, setEmail] = useState(''), [name, setName] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('');
  if (signedIn(s)) return <Navigate to={next} replace/>;
  const handleSend = async () => {
    if (!validEmail(email) || !name.trim() || busy) return;
    setBusy(true); setError('');
    try {
      await sendCode(email, 'signup');
      navigate(`/signup/verify?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&next=${encodeURIComponent(next)}`);
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <AuthShell title="이메일 회원가입" onBack={() => navigate(`/welcome?next=${encodeURIComponent(next)}`)}>
      <div className="mb-7 flex items-center justify-between">
        <p className="text-[20px] font-bold tracking-[-.7px]">이름과 이메일을 입력해 주세요.</p>
        <span className="muted text-[11px]">01 / 02</span>
      </div>
      <div className="space-y-6">
        <Field label="이름" required><input aria-label="이름" value={name} onChange={e => setName(e.target.value)} autoComplete="name" maxLength={30} placeholder="실명을 입력해 주세요" className={inputClass}/></Field>
        <Field label="이메일" required><div className="flex items-center gap-3"><input aria-label="이메일" type="email" autoComplete="email" autoCapitalize="none" value={email} onChange={e => { setEmail(e.target.value); setError(''); }} placeholder="가입할 이메일 주소" className={`${inputClass} flex-1`}/><Button outline className="min-h-9! shrink-0 px-3 text-[11px]!" disabled={busy || !validEmail(email) || !name.trim()} onClick={handleSend}>{busy ? '전송 중…' : '인증번호 요청'}</Button></div></Field>
        <p className="muted text-[11px] leading-relaxed">구매와 판매에 사용할 하나의 계정을 만들어요.<br/>판매자 신청은 가입 후 마이페이지에서 진행할 수 있어요.</p>
        <ErrorBox message={error}/>
      </div>
    </AuthShell>
  );
}
export function SignupVerifyPage() {
  const s = useStore(), navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') || '', name = params.get('name') || '', next = safeNext(params.get('next'));
  if (!email || !name) return <Navigate to={`/signup?next=${encodeURIComponent(next)}`} replace/>;
  if (signedIn(s)) return <Navigate to={next} replace/>;
  const [code, setCode] = useState(''), [busy, setBusy] = useState(false), [codeError, setCodeError] = useState(''), [error, setError] = useState(''), [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  const c = s.auth?.challenges[`signup:${normalizeEmail(email)}`];
  const remain = Math.max(0, Math.ceil(((c?.expiresAt ?? now) - now) / 1000));
  const cooldown = c ? Math.max(0, Math.ceil((c.sentAt + 60000 - now) / 1000)) : 0;
  const remainLabel = remain ? `${Math.floor(remain / 60).toString().padStart(2, '0')}:${String(remain % 60).padStart(2, '0')}` : '';
  const goNext = () => navigate(`/signup/info?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&next=${encodeURIComponent(next)}`, { replace: true });
  const resend = async () => { setBusy(true); setError(''); try { await sendCode(email, 'signup'); setNow(Date.now()); setCode(''); setCodeError(''); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } };
  const verify = async () => { setBusy(true); setError(''); setCodeError(''); try { const err = await verifyCode(email, 'signup', code); if (err) { setCodeError(err); setCode(''); } else goNext(); } catch (e) { setCodeError((e as Error).message); } finally { setBusy(false); } };
  return (
    <AuthShell title="이메일 인증" onBack={() => navigate(`/signup?next=${encodeURIComponent(next)}`)}>
      <p className="mb-7 text-[20px] font-bold tracking-[-.7px]">입력하신 이메일로 인증번호를 보냈어요.</p>
      <div className="space-y-5">
        <p className="text-[13px] text-[var(--muted)]">{normalizeEmail(email)}</p>
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><span className="text-[13px] font-bold">인증번호</span><span className="text-[11px] text-[var(--muted)]">· 필수</span></div>
            {remainLabel && <span className="text-[12px] font-bold text-[var(--red)]">{remainLabel}</span>}
          </div>
          <div className="flex gap-1.5 py-3">{[0,1,2,3,4,5].map(i => <div key={i} className={`flex h-[55px] flex-1 items-center justify-center rounded-[4px] border text-[22px] font-bold ${codeError ? 'border-[var(--red)]' : code.length > i ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}>{code[i] ?? ''}</div>)}</div>
          <input aria-label="이메일 인증번호" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => { setCode(e.target.value.replace(/\D/g, '')); setCodeError(''); }} className="sr-only"/>
          {codeError && <p className="text-[12px] text-[var(--red)]">인증번호가 일치하지 않아요.</p>}
          {!remain && <p className="text-[12px] text-[var(--muted)]">인증 시간이 지났어요. 다시 요청해 주세요.</p>}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[12px] text-[var(--muted)]">메일을 받지 못했나요?</span>
          <Button outline className="min-h-9! px-3 text-[11px]!" disabled={busy || cooldown > 0} onClick={resend}>{cooldown ? `재전송 (${cooldown}초 후 활성화)` : '재전송'}</Button>
        </div>
        <div className="rounded-[4px] bg-[var(--blue-soft)] px-4 py-3 text-[12px] text-[var(--muted)]">인증번호는 3분 동안 유효해요. 메일이 보이지 않으면 스팸함도 확인해 주세요.</div>
        <ErrorBox message={error}/>
        {code.length === 6 && remain > 0 && <Button className="w-full" disabled={busy} onClick={verify}>인증 확인</Button>}
      </div>
    </AuthShell>
  );
}

/** 회원가입 2단계: 비밀번호 + 연락처 + 약관 */
export function SignupInfoPage() {
  const s = useStore(), navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') || '', nameParam = params.get('name') || '', next = safeNext(params.get('next'));
  const [nameValue, setNameValue] = useState(nameParam);
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [phone, setPhone] = useState(''), [checks, setChecks] = useState({ age: false, terms: false, privacy: false, marketing: false }), [legal, setLegal] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false);
  const authNow = useAuthNow(), c = s.auth?.challenges[`signup:${normalizeEmail(email)}`], verified = !!c?.verified && c.expiresAt > authNow;
  if (signedIn(s) && !busy) return <Navigate to={next} replace/>;
  if (!email || !nameParam) return <Navigate to={`/signup?next=${encodeURIComponent(next)}`} replace/>;
  return (
    <AuthShell title="가입 정보 입력" onBack={() => navigate(`/signup?next=${encodeURIComponent(next)}`)}>
      <p className="mb-6 text-[13px] text-[var(--muted)]">구매와 판매에 사용할 하나의 계정을 만들어요.</p>
      <form className="space-y-6" onSubmit={async e => { e.preventDefault(); if (busy) return; setError(''); if (password !== confirmation) return setError('비밀번호가 일치하지 않습니다.'); setBusy(true); try { await signup({ email, password, name: nameValue.trim(), phone, ...checks }); navigate(`/signup/done?next=${encodeURIComponent(next)}`, { replace: true }); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
        <div className="flex items-center justify-between border-b border-[var(--line)] pb-4">
          <div className="flex items-center gap-2 min-w-0"><span className="min-w-0 break-all text-[12px]">{normalizeEmail(email)}</span><span className="shrink-0 rounded-full bg-[var(--green-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--green)]">인증 완료</span></div>
          <button type="button" onClick={() => navigate(`/signup?next=${encodeURIComponent(next)}`)} className="muted shrink-0 p-2 text-[11px] underline">이메일 변경</button>
        </div>
        {!verified && <Note>인증 시간이 지났어요. 이메일을 다시 인증해 주세요.</Note>}
        <Field label="이름" required><input aria-label="이름" value={nameValue} onChange={e => setNameValue(e.target.value)} autoComplete="name" maxLength={30} className={inputClass}/></Field>
        <Field label="휴대폰 번호" required hint="주문·배송 및 문의 연락처로 사용해요."><input aria-label="휴대폰 번호" type="tel" value={phone} onChange={e => setPhone(e.target.value)} autoComplete="tel" maxLength={13} placeholder="01012345678" className={inputClass}/></Field>
        <PasswordField value={password} onChange={setPassword}/>
        <PasswordField label="비밀번호 확인" value={confirmation} onChange={setConfirmation} placeholder="비밀번호를 한 번 더 입력해 주세요"/>
        {confirmation && confirmation !== password && <p className="text-[11px] text-[var(--red)]">비밀번호가 일치하지 않아요.</p>}
        <fieldset className="space-y-3 border-t border-[var(--line)] pt-5">
          <legend className="sr-only">약관 동의</legend>
          <label className="divider flex items-center gap-3 pb-4 text-[14px] font-bold"><input aria-label="약관 전체 동의" type="checkbox" checked={Object.values(checks).every(Boolean)} onChange={e => setChecks({ age: e.target.checked, terms: e.target.checked, privacy: e.target.checked, marketing: e.target.checked })} className="h-4 w-4"/>전체 동의</label>
          {([['age', '만 14세 이상', '필수', false], ['terms', '서비스 이용약관', '필수', true], ['privacy', '개인정보 수집·이용', '필수', true], ['marketing', '혜택 및 마케팅 정보 수신', '선택', false]] as const).map(([key, label, badge, hasView]) => <div key={key} className="flex items-center gap-2"><label className="flex min-w-0 flex-1 items-center gap-2 text-[11px]"><input type="checkbox" checked={checks[key]} onChange={e => setChecks({ ...checks, [key]: e.target.checked })} className="h-4 w-4 shrink-0"/><span className={`shrink-0 rounded px-1 py-px text-[9px] font-bold ${badge === '필수' ? 'bg-[var(--ink)] text-[var(--surface)]' : 'border border-[var(--line)] text-[var(--muted)]'}`}>{badge}</span>{label}</label>{hasView && <button type="button" aria-label={key === 'terms' ? '이용약관 보기' : '개인정보 동의 내용 보기'} onClick={() => setLegal(key)} className="muted shrink-0 p-2 text-[11px] underline">보기</button>}</div>)}
        </fieldset>
        <ErrorBox message={error}/>
        <Button type="submit" className="w-full" disabled={busy || !verified || !nameValue.trim() || !phone || !validPassword(password) || password !== confirmation || !checks.age || !checks.terms || !checks.privacy}>{busy ? '가입 중…' : '가입하기'}</Button>
      </form>
      {legal && <Modal title={legal === 'terms' ? '서비스 이용약관' : '개인정보 수집·이용'} onClose={() => setLegal('')}><LegalContent kind={legal}/><Button className="mt-6 w-full" onClick={() => setLegal('')}>내용 확인</Button></Modal>}
    </AuthShell>
  );
}
export function SignupDonePage() { const s = useStore(), next = useNext(); if (!signedIn(s)) return <Navigate to="/login" replace/>; const user = s.users.find(u => u.id === s.activeUserId)!; return <div className="flex min-h-[calc(100dvh-60px)] flex-col"><Wordmark/><div className="flex flex-1 flex-col justify-center py-12"><Check size={38} strokeWidth={1.5}/><p className="mt-7 text-[10px] font-bold tracking-[2px]">WELCOME TO STOCKDROP</p><h1 className="mt-4 break-words text-[30px] font-bold leading-[1.5] tracking-[-1px]">{user.name}님,<br/>가입을 환영해요</h1><p className="muted mt-4 text-[12px] leading-[1.9]">지금부터 3시간 한정 드롭에<br/>바로 참여할 수 있어요.</p></div><div className="space-y-3 pb-6"><Link className="btn w-full" to={`/categories?next=${encodeURIComponent(next)}`}>상품 둘러보기</Link><Link className="btn btn-outline w-full" to="/apply">판매자 입점 신청</Link><p className="muted text-center text-[10px]">입점 신청만으로 판매 권한이 추가되지는 않습니다.</p></div></div>; }
/** 비밀번호 재설정 1단계: 이메일 인증 → /reset-password/new 로 이동 */
export function ResetPasswordPage() {
  const next = useNext(), navigate = useNavigate();
  const [email, setEmail] = useState(''), [error, setError] = useState('');
  const authNow = useAuthNow(), s = useStore(), c = s.auth?.challenges[`reset:${normalizeEmail(email)}`], verified = !!c?.verified && c.expiresAt > authNow;
  return (
    <AuthShell title="비밀번호 재설정" onBack={() => navigate(`/login?next=${encodeURIComponent(next)}`)}>
      <h1 className="text-[22px] font-bold">가입한 이메일을 확인해요.</h1>
      <p className="mb-7 mt-2 text-[13px] text-[var(--muted)]">인증이 끝나면 새 비밀번호를 설정할 수 있어요.</p>
      <div className="space-y-6">
        <EmailVerification email={email} setEmail={setEmail} purpose="reset" onError={setError}/>
        <ErrorBox message={error}/>
        <Button className="w-full" disabled={!verified} onClick={() => navigate(`/reset-password/new?email=${encodeURIComponent(email)}&next=${encodeURIComponent(next)}`)}>비밀번호 변경하기</Button>
        <p className="text-center text-[11px] text-[var(--muted)]">가입하지 않은 이메일이면 인증번호가 발송되지 않아요.</p>
      </div>
    </AuthShell>
  );
}

/** 비밀번호 재설정 2단계: 새 비밀번호 입력 */
export function ResetPasswordNewPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const email = params.get('email') || '', next = safeNext(params.get('next'));
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState(''), [error, setError] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false);
  const authNow = useAuthNow(), s = useStore(), c = s.auth?.challenges[`reset:${normalizeEmail(email)}`], verified = !!c?.verified && c.expiresAt > authNow;
  if (!email) return <Navigate to="/reset-password" replace/>;
  if (!verified) return <Navigate to={`/reset-password?next=${encodeURIComponent(next)}`} replace/>;
  return (
    <AuthShell title="비밀번호 재설정" onBack={() => navigate(-1)}>
      {done ? (
        <div className="space-y-6">
          <Check size={30}/>
          <h1 className="text-[24px] font-bold">비밀번호가 변경됐어요.</h1>
          <p className="muted text-[12px]">새 비밀번호로 다시 로그인해 주세요.</p>
          <Link className="btn w-full" to={`/login?next=${encodeURIComponent(next)}`}>로그인으로</Link>
        </div>
      ) : (
        <form className="space-y-6" onSubmit={async e => { e.preventDefault(); if (busy) return; setError(''); if (password !== confirmation) return setError('비밀번호가 일치하지 않습니다.'); setBusy(true); try { await resetPassword(email, password); setDone(true); } catch (e) { setError((e as Error).message); } finally { setBusy(false); } }}>
          <h1 className="text-[22px] font-bold">새 비밀번호를 설정해 주세요</h1>
          <p className="text-[13px] text-[var(--muted)]">변경이 끝나면 로그인 화면으로 이동해요.</p>
          <PasswordField label="새 비밀번호" value={password} onChange={setPassword}/>
          {password && <div className="flex gap-4 text-[12px] font-bold">
            <span className={password.length >= 8 && password.length <= 32 ? 'text-[var(--green)]' : 'text-[var(--muted)]'} style={{display:'flex',alignItems:'center',gap:4}}><Check size={13} strokeWidth={2}/>8~32자</span>
            <span className={/[a-zA-Z]/.test(password) && /\d/.test(password) && /[^a-zA-Z0-9]/.test(password) ? 'text-[var(--green)]' : 'text-[var(--muted)]'} style={{display:'flex',alignItems:'center',gap:4}}><Check size={13} strokeWidth={2}/>영문·숫자·특수문자</span>
          </div>}
          <PasswordField label="새 비밀번호 확인" value={confirmation} onChange={setConfirmation}/>
          {confirmation && confirmation === password && <p className="text-[12px] text-[var(--green)]">비밀번호가 일치해요.</p>}
          {confirmation && confirmation !== password && <p className="text-[11px] text-[var(--red)]">비밀번호가 일치하지 않아요.</p>}
          <ErrorBox message={error}/>
          <Button type="submit" className="w-full" disabled={busy || !validPassword(password) || password !== confirmation}>{busy ? '변경 중…' : '비밀번호 변경하기'}</Button>
        </form>
      )}
    </AuthShell>
  );
}
export function CategorySelectionPage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const next = safeNext(params.get('next'));
  const CATS = ['의류·패션', '생활용품', '전자기기', '가전제품', '인테리어·가구', '공구·자재', '식품·음료', '뷰티·헬스', '스포츠·레저', '문구·도서', '유아·아동', '기타'];
  const [selected, setSelected] = useState<string[]>(() => { try { return JSON.parse(localStorage.getItem('stockdrop:categories') || '[]'); } catch { return []; } });
  const toggle = (cat: string) => setSelected(s => s.includes(cat) ? s.filter(c => c !== cat) : [...s, cat]);
  const proceed = (cats: string[]) => { try { localStorage.setItem('stockdrop:categories', JSON.stringify(cats)); } catch {} navigate(`/notifications/settings?next=${encodeURIComponent(next)}`); };
  return <div className="flex min-h-[calc(100dvh-60px)] flex-col">
    <header className="flex items-center justify-between py-3">
      <button className="muted py-2" aria-label="이전 화면" onClick={() => navigate(-1)}><ArrowLeft size={18}/></button>
      <button className="muted py-2 text-[12px]" onClick={() => proceed([])}>건너뛰기</button>
    </header>
    <div className="mb-1 h-[3px] w-full bg-[var(--line)]"><div className="h-[3px] w-1/2 rounded-r-full bg-[var(--ink)]"/></div>
    <div className="flex justify-end py-2 text-[11px] text-[var(--muted)]"><span className="font-bold text-[var(--ink)]">1</span><span> / 2</span></div>
    <div className="flex-1 space-y-4 pt-2">
      <h1 className="text-[20px] font-bold leading-[1.4] tracking-[-0.5px]">관심 카테고리를 선택해주세요</h1>
      <p className="text-[13px] text-[var(--muted)]">선택한 카테고리를 기반으로 맞춤 상품과 알림을 보내드려요.<br/>복수 선택이 가능합니다.</p>
      <div className="h-[1px] bg-[var(--line)]"/>
      <div className="grid grid-cols-2 gap-2 pt-1">{CATS.map(cat => { const on = selected.includes(cat); return <button key={cat} onClick={() => toggle(cat)} className={`relative flex items-center justify-between rounded-[10px] border px-4 py-[17px] text-[14px] transition-colors ${on ? 'border-[#858585] bg-[#EBEBEB] font-bold' : 'border-[var(--line)] bg-[var(--surface)]'}`}>{cat}{on && <Check size={16} className="shrink-0 rounded-full bg-[var(--ink)] p-[2px] text-[var(--surface)]"/>}</button>; })}</div>
    </div>
    <div className="pb-6 pt-4"><Button className="w-full" onClick={() => proceed(selected)} disabled={!selected.length}>{selected.length ? `${selected.length}개 선택 · 다음으로` : '카테고리를 선택해주세요'}</Button></div>
  </div>;
}
export function NotificationSettingsPage() {
  const navigate = useNavigate(); const [params] = useSearchParams(); const next = safeNext(params.get('next'));
  const NOTIFS = [{ id: 'sale_start', title: '판매 시작 알림', desc: '관심 상품 판매 시작 즉시 알려드려요' }, { id: 'price_change', title: '관심 상품 가격 변동', desc: '찜한 상품 가격 변동 시 알려드려요' }, { id: 'low_stock', title: '한정 수량 임박 알림', desc: '재고가 5개 이하 남으면 알려드려요' }, { id: 'recommendation', title: '개인 맞춤 상품 추천', desc: '취향에 맞는 새 상품 등록 시 알려드려요' }];
  const [enabled, setEnabled] = useState<Record<string, boolean>>(() => { try { return JSON.parse(localStorage.getItem('stockdrop:notifications') || '{}'); } catch { return {}; } });
  const [marketing, setMarketing] = useState(false);
  const [pushState, setPushState] = useState<'default' | 'granted' | 'denied' | 'busy'>(() => (Notification.permission as any));
  const [pushToken, setPushToken] = useState<string | null>(null);
  const toggle = (id: string) => setEnabled(e => ({ ...e, [id]: !e[id] }));
  const allowPush = async () => { setPushState('busy'); const token = await requestPushPermission(); if (token) { setPushState('granted'); setPushToken(token); } else { setPushState(Notification.permission as any); } };
  useEffect(() => { if (Notification.permission === 'granted') allowPush(); }, []);
  useEffect(() => { apiGet('/accounts/me/notification-settings').then((data: any) => { if (!data) return; setEnabled(e => ({ ...e, sale_start: !!data.saleStart, recommendation: !!data.personalizedRecommendation })); if (data.marketingConsent !== undefined) setMarketing(!!data.marketingConsent); }).catch(() => {}); }, []);
  const proceed = () => {
    try { localStorage.setItem('stockdrop:notifications', JSON.stringify({ ...enabled, marketing })); } catch {}
    apiPut('/accounts/me/notification-settings', { saleStart: !!enabled['sale_start'], personalizedRecommendation: !!enabled['recommendation'] }).catch(() => {});
    apiPut('/accounts/me/marketing-consent', { marketingConsent: marketing }).catch(() => {});
    navigate(next, { replace: true });
  };
  return <div className="flex min-h-[calc(100dvh-60px)] flex-col">
    <header className="flex items-center justify-between py-3">
      <button className="muted" aria-label="이전 화면" onClick={() => navigate(-1)}><ArrowLeft size={18}/></button>
      <span className="text-[17px] font-bold">알림 설정</span>
      <button className="muted py-2 text-[13px]" onClick={proceed}>건너뛰기</button>
    </header>
    <div className="mb-1 h-[3px] w-full bg-[var(--line)]"><div className="h-[3px] w-full rounded-r-full bg-[var(--ink)]"/></div>
    <div className="flex justify-end py-2 text-[11px] text-[var(--muted)]"><span className="font-bold text-[var(--ink)]">2</span><span> / 2</span></div>
    <div className="flex-1 space-y-5 pt-2">
      <div className="flex flex-col items-center gap-3 py-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--line)]"><Bell size={22} strokeWidth={1.5}/></div>
        <h1 className="text-[16px] font-bold">나에게 딱 맞는 알림을 받아보세요</h1>
        <p className="text-center text-[12px] text-[var(--muted)]">구매 이력을 분석해 꼭 필요한 판매 알림만 보내드려요.</p>
      </div>
      <div className="h-[1px] bg-[var(--line)]"/>
      <div>{NOTIFS.map(n => <div key={n.id} className="divider flex items-center justify-between gap-4 py-4">
        <div className="flex-1"><p className="text-[14px] font-bold">{n.title}</p><p className="muted mt-0.5 text-[12px]">{n.desc}</p></div>
        <button role="switch" aria-checked={!!enabled[n.id]} onClick={() => toggle(n.id)} className={`relative h-[28px] w-[48px] shrink-0 rounded-full transition-colors ${enabled[n.id] ? 'bg-[var(--ink)]' : 'bg-[var(--line)]'}`}><span className={`absolute top-[3px] h-[22px] w-[22px] rounded-full bg-white shadow-sm transition-all ${enabled[n.id] ? 'left-[23px]' : 'left-[3px]'}`}/></button>
      </div>)}</div>
      <div className="h-[1px] bg-[var(--line)]"/>
      <label className="flex items-start gap-3 rounded-[6px] bg-[#FBFBFB] p-4 text-[13px] font-bold">
        <input type="checkbox" checked={marketing} onChange={e => setMarketing(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 rounded-[4px]"/>
        <div><p>광고성 정보 수신 동의 (선택)</p><p className="muted mt-1 text-[11px] font-normal leading-relaxed">개인 맞춤 알림 서비스를 위해 마케팅 정보 수신에 동의합니다.</p></div>
      </label>
      {pushToken && <p className="break-all rounded bg-[var(--blue-soft)] p-2 text-[9px] select-all">{pushToken}</p>}
    </div>
    <div className="pb-6 pt-4"><Button className="w-full" onClick={proceed}>알림 받기 시작</Button></div>
  </div>;
}
export function LogoutButton() { const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), navigate = useNavigate(), toast = useToast(); return <><button className="muted py-4 text-[12px] underline underline-offset-4" onClick={() => setOpen(true)}>로그아웃</button>{open && <Modal title="로그아웃할까요?" onClose={() => setOpen(false)}><Note>주문과 신청 내역은 유지됩니다. 진행 중인 재고 확보 시간은 로그아웃해도 멈추거나 연장되지 않습니다.</Note><div className="mt-6 flex gap-3"><Button outline className="flex-1" onClick={() => setOpen(false)}>취소</Button><Button className="flex-1" disabled={busy} onClick={async () => { setBusy(true); await logout(); navigate('/', { replace: true }); toast('로그아웃했습니다.'); }}>로그아웃하기</Button></div></Modal>}</>; }
