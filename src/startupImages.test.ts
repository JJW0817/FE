import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** 아이폰은 기기의 CSS 크기·배율·방향과 media가 정확히 맞고 이미지 픽셀 크기가 같을 때만 정지 화면을 쓴다. 어긋나면 흰 화면 */
const html = readFileSync('index.html', 'utf-8');
const links = [...html.matchAll(/<link rel="apple-touch-startup-image" href="\.\/([^"]+)" media="\(device-width: (\d+)px\) and \(device-height: (\d+)px\) and \(-webkit-device-pixel-ratio: (\d)\) and \(orientation: portrait\)"\/>/g)].map(m => ({ file: m[1], w: +m[2], h: +m[3], r: +m[4] }));
// iPhone SE ~ 17 Air·16 Pro Max (세로) — [CSS 가로, CSS 세로, 배율]
const DEVICES: [string, number, number, number][] = [['SE 1세대·5s', 320, 568, 2], ['SE 2·3세대·8·7', 375, 667, 2], ['8 Plus·7 Plus', 414, 736, 3], ['X·XS·11 Pro·12/13 mini', 375, 812, 3], ['XR·11', 414, 896, 2], ['XS Max·11 Pro Max', 414, 896, 3], ['12·13·14·16e', 390, 844, 3], ['12·13 Pro Max·14 Plus', 428, 926, 3], ['15·15 Pro·16', 393, 852, 3], ['14 Pro Max·15 Plus·15 Pro Max·16 Plus', 430, 932, 3], ['16 Pro·17·17 Pro', 402, 874, 3], ['Air', 420, 912, 3], ['16 Pro Max·17 Pro Max', 440, 956, 3]];

describe('apple-touch-startup-image', () => {
  it.each(DEVICES)('%s (%ipx x %ipx @%i)에 맞는 이미지가 있고 픽셀 크기가 같다', (_name, w, h, r) => {
    const l = links.find(x => x.w === w && x.h === h && x.r === r);
    expect(l, `${w}x${h}@${r} 링크`).toBeDefined();
    expect(existsSync(`public/${l!.file}`)).toBe(true);
    const png = readFileSync(`public/${l!.file}`); // PNG 헤더의 폭·높이
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([w * r, h * r]);
  });
  it('첫 프레임: html·body 인라인 배경과 #boot, 상태 표시줄·theme-color·manifest가 모두 #0E0E0F 계열', () => {
    expect(html).toMatch(/<html[^>]*style="background:#0E0E0F"/); expect(html).toMatch(/<body[^>]*style="background:#0E0E0F"/); expect(html).toMatch(/id="boot"[^>]*background:#0E0E0F/);
    expect(html).toContain('<meta name="theme-color" content="#0E0E0F"/>'); expect(html).toContain('status-bar-style" content="black-translucent"');
    const m = JSON.parse(readFileSync('public/manifest.webmanifest', 'utf-8')); expect([m.background_color, m.theme_color]).toEqual(['#0E0E0F', '#0E0E0F']);
  });
});
