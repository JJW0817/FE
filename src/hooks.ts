import { useEffect, useState } from 'react';
import { useStore } from './store';
export function useClock() { const state = useStore(); const [realNow, setRealNow] = useState(Date.now()); useEffect(() => { const timer = setInterval(() => setRealNow(Date.now()), 1000); return () => clearInterval(timer); }, []); return realNow + state.clockOffset; }
export function dateTime(value: number) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(value); }
export function shortDate(value: number) { return new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric' }).format(value); }
export function countdown(expires: number, now: number) { const seconds = Math.max(0, Math.floor((expires - now) / 1000)); const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const rest = seconds % 60; return [hours, minutes, rest].map(n => String(n).padStart(2, '0')).slice(hours ? 0 : 1).join(':'); }
/** 서버 시각(UTC) → 한국 시간 조각. 기기 시간대와 무관하게 Asia/Seoul로 보여 준다 */
function kst(value: number) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', month: 'numeric', day: 'numeric', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value).map(x => [x.type, x.value]));
  return { month: p.month, day: p.day, weekday: p.weekday, time: `${p.hour}:${p.minute}` };
}
/** 예: 11월 3일 (화) 21:00 */
export function kstSlot(value: number) { const k = kst(value); return `${k.month}월 ${k.day}일 (${k.weekday}) ${k.time}`; }
/** 예: 11.3 21:00 */
export function kstShort(value: number) { const k = kst(value); return `${k.month}.${k.day} ${k.time}`; }
