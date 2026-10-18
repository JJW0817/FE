import { useEffect, useState } from 'react';
import { useStore } from './store';
export function useClock() { const state = useStore(); const [realNow, setRealNow] = useState(Date.now()); useEffect(() => { const timer = setInterval(() => setRealNow(Date.now()), 1000); return () => clearInterval(timer); }, []); return realNow + state.clockOffset; }
export function dateTime(value: number) { return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(value); }
export function shortDate(value: number) { return new Intl.DateTimeFormat('ko-KR', { month: 'long', day: 'numeric' }).format(value); }
export function countdown(expires: number, now: number) { const seconds = Math.max(0, Math.floor((expires - now) / 1000)); const hours = Math.floor(seconds / 3600); const minutes = Math.floor(seconds % 3600 / 60); const rest = seconds % 60; return [hours, minutes, rest].map(n => String(n).padStart(2, '0')).slice(hours ? 0 : 1).join(':'); }
