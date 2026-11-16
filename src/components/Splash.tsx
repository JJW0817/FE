import { useEffect, useState } from 'react';
import { LOGO_LETTERS, LOGO_VIEWBOX } from '../splashLogo';
import { authReady } from '../splash';

/** 앱을 새로 열거나 새로고침할 때만 한 번(같은 페이지 안의 화면 이동에서는 다시 안 나온다) */
/** 자동화 브라우저(e2e)에서는 클릭을 가리지 않게 건너뛴다 — 시작 화면 자체를 검사하는 테스트는 navigator.webdriver를 false로 덮어쓴다 */
let played = typeof navigator !== 'undefined' && navigator.webdriver === true;
const MIN_MS = 1200, MAX_MS = 3000, FADE_MS = 300, LETTER_GAP = 70, WORD_GAP = 140;
const delay = (ms: number) => new Promise<void>(r => setTimeout(r, ms));
/** 글자별 시작 시각: S·T·O·C·K 70ms 간격, 단어 사이 140ms, 이어서 D·R·O·P */
const startAt = (i: number) => (i < 5 ? i * LETTER_GAP : 4 * LETTER_GAP + WORD_GAP + (i - 5) * LETTER_GAP);

export function Splash() {
  const [phase, setPhase] = useState<'show' | 'out' | 'gone'>(() => (played ? 'gone' : 'show'));
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  useEffect(() => {
    if (played) return; played = true;
    let alive = true;
    // 최소 1.2초(움직임 줄이기는 0.6초) + 로그인 확인이 끝날 때까지, 단 3초를 넘기지 않는다
    Promise.race([Promise.all([delay(reduced ? 600 : MIN_MS), authReady]), delay(MAX_MS)]).then(async () => {
      if (!alive) return;
      if (reduced) { setPhase('gone'); return; }
      setPhase('out'); await delay(FADE_MS); if (alive) setPhase('gone');
    });
    return () => { alive = false; };
  }, []);
  if (phase === 'gone') return null;
  const [vx, vy, vw, vh] = LOGO_VIEWBOX;
  return <div role="img" aria-label="STOCKDROP" className="splash" style={{ opacity: phase === 'out' ? 0 : 1, pointerEvents: phase === 'out' ? 'none' : 'auto' }}>
    <div className="splash-logo" style={{ width: 300, height: Math.round(300 * vh / vw) }}>
      {LOGO_LETTERS.map((l, i) => <svg key={i} viewBox={`${vx} ${vy} ${vw} ${vh}`} aria-hidden="true" className={reduced ? 'splash-letter' : 'splash-letter splash-drop'} style={reduced ? undefined : { animationDelay: `${startAt(i)}ms` }}><path d={l.d} fill="#FFFFFF"/></svg>)}
    </div>
  </div>;
}
