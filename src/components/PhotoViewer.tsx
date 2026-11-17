import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronLeft, ChevronRight, Minus, Plus, X } from 'lucide-react';

/** 전체 화면 사진 보기 — 좌우로 넘기고(버튼·스와이프·방향키) 확대/축소. panel은 사진 아래에 같이 보여 줄 내용(검수 항목 등) */
export function PhotoViewer({ images, start = 0, onClose, panel }: { images: string[]; start?: number; onClose: () => void; panel?: ReactNode }) {
  const [i, setI] = useState(Math.min(start, images.length - 1)), [zoom, setZoom] = useState(1), touchX = useRef<number | null>(null);
  const go = (d: number) => { setI(v => (v + d + images.length) % images.length); setZoom(1); };
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowLeft') go(-1); else if (e.key === 'ArrowRight') go(1); };
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key);
  }, [images.length]);
  if (!images.length) return null;
  const step = (d: number) => setZoom(z => Math.min(4, Math.max(1, +(z + d).toFixed(2))));
  return <div role="dialog" aria-modal="true" aria-label="사진 크게 보기" className="fixed inset-0 z-[100] mx-auto flex max-w-[390px] flex-col bg-black pt-[env(safe-area-inset-top)] text-white">
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-[13px]" aria-live="polite">{i + 1} / {images.length}</span>
      <div className="flex items-center gap-3">
        <button aria-label="축소" disabled={zoom <= 1} onClick={() => step(-0.5)} className="disabled:opacity-30"><Minus size={20}/></button>
        <span className="w-9 text-center text-[12px]">{Math.round(zoom * 100)}%</span>
        <button aria-label="확대" disabled={zoom >= 4} onClick={() => step(0.5)} className="disabled:opacity-30"><Plus size={20}/></button>
        <button aria-label="닫기" onClick={onClose}><X size={22}/></button>
      </div>
    </div>
    <div className="relative min-h-0 flex-1 overflow-auto" onTouchStart={e => { touchX.current = zoom === 1 ? e.touches[0].clientX : null; }} onTouchEnd={e => { if (touchX.current === null) return; const dx = e.changedTouches[0].clientX - touchX.current; touchX.current = null; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); }}>
      <img src={images[i]} alt={`사진 ${i + 1}`} onDoubleClick={() => setZoom(z => (z > 1 ? 1 : 2))} className="mx-auto block max-w-none select-none object-contain" style={{ width: `${zoom * 100}%`, maxHeight: zoom === 1 ? '100%' : undefined, height: zoom === 1 ? '100%' : 'auto' }}/>
      {images.length > 1 && zoom === 1 && <>
        <button aria-label="이전 사진" onClick={() => go(-1)} className="absolute left-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50"><ChevronLeft size={22}/></button>
        <button aria-label="다음 사진" onClick={() => go(1)} className="absolute right-2 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-black/50"><ChevronRight size={22}/></button>
      </>}
    </div>
    {panel && <div className="max-h-[42%] overflow-y-auto bg-white p-4 text-[var(--ink)]">{panel}</div>}
  </div>;
}
