import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { BottomSheet } from './ui';

/** 은행 선택 목록. 서버는 은행을 코드가 아니라 이름(bankName ≤50)으로 받으므로 선택한 이름을 그대로 보낸다 */
export const BANKS = ['KB국민', '신한', '우리', '하나', 'NH농협', 'IBK기업', 'SC제일', '카카오뱅크', '토스뱅크', '케이뱅크', '우체국', '새마을금고', '수협', 'iM뱅크(대구)', '부산', '경남', '광주', '전북', '제주', '씨티'] as const;

/** 직접 입력 대신 아래에서 올라오는 선택 시트로 은행을 고른다. 입점 신청과 판매자 정산 계좌 입력이 같이 쓴다 */
export function BankField({ value, onChange, label = '정산 은행' }: { value: string; onChange: (bank: string) => void; label?: string }) {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" aria-label={label} aria-haspopup="dialog" onClick={() => setOpen(true)} className="field flex w-full items-center justify-between text-left">
      <span className={value ? '' : 'text-[var(--placeholder)]'}>{value || '은행을 선택해 주세요'}</span><ChevronDown size={18} className="muted shrink-0"/>
    </button>
    {open && <BottomSheet title="은행 선택" onClose={() => setOpen(false)}>
      <div role="listbox" aria-label="은행 목록" className="grid max-h-[60dvh] grid-cols-2 gap-2 overflow-y-auto px-4 pb-6">
        {BANKS.map(b => <button key={b} type="button" role="option" aria-selected={value === b} onClick={() => { onChange(b); setOpen(false); }} className={`h-12 rounded-[8px] border text-[14px] ${value === b ? 'border-[var(--ink)] bg-[var(--soft)] font-bold' : 'border-[var(--line)]'}`}>{b}</button>)}
      </div>
    </BottomSheet>}
  </>;
}
