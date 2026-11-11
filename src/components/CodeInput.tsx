import { useEffect, useRef } from 'react';
export const sanitizeCode = (v: string) => v.replace(/\D/g, '').slice(0, 6);
/** 6칸 인증번호. 실제 input 하나를 칸 위에 투명하게 덮어, 어디를 눌러도 포커스·붙여넣기·숫자 키패드가 동작한다 */
export function CodeInput({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error?: boolean; disabled?: boolean }) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { ref.current?.focus(); }, []);
  return <div className="relative flex gap-1.5 py-3">
    {[0, 1, 2, 3, 4, 5].map(i => <div key={i} className={`flex h-[55px] flex-1 items-center justify-center rounded-[4px] border text-[22px] font-bold ${error ? 'border-[var(--red)]' : value.length > i ? 'border-[var(--ink)]' : 'border-[var(--line)]'}`}>{value[i] ?? ''}</div>)}
    <input ref={ref} aria-label="이메일 인증번호" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" disabled={disabled} value={value} onChange={e => onChange(sanitizeCode(e.target.value))} className="absolute inset-0 h-full w-full cursor-text opacity-0"/>
  </div>;
}
