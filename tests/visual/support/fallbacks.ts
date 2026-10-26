// Respaldos locales para recursos externos. Ninguna captura depende de la red:
// las portadas se sustituyen por un SVG determinista (color derivado de la URL,
// retícula visible para notar escalados y recortes) y los reproductores por una
// página local del mismo proveedor.
import { createHash } from 'node:crypto';

function hue(seed: string) {
  return createHash('sha1').update(seed).digest().readUInt16BE(0) % 360;
}

export function coverSvg(url: string) {
  const h = hue(url);
  const lines = Array.from({ length: 9 }, (_, i) => {
    const p = 70 * (i + 1);
    return `<path d="M${p} 0V700M0 ${p}H700" />`;
  }).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="700" height="700" viewBox="0 0 700 700">
<rect width="700" height="700" fill="hsl(${h} 22% 24%)"/>
<g stroke="hsl(${h} 22% 31%)" stroke-width="2" fill="none">${lines}</g>
<path d="M0 0L700 700M700 0L0 700" stroke="hsl(${h} 24% 38%)" stroke-width="3"/>
<circle cx="350" cy="350" r="160" fill="hsl(${(h + 180) % 360} 18% 36%)"/>
<circle cx="350" cy="350" r="22" fill="hsl(${h} 22% 24%)"/>
<rect x="4" y="4" width="692" height="692" fill="none" stroke="hsl(${h} 28% 46%)" stroke-width="8"/>
</svg>`;
}

const PROVIDERS: Array<{ test: RegExp; name: string }> = [
  { test: /bandcamp\.com\/EmbeddedPlayer/, name: 'Bandcamp' },
  { test: /w\.soundcloud\.com\/player/, name: 'SoundCloud' },
  { test: /open\.spotify\.com\/embed/, name: 'Spotify' }
];

export function embedProvider(url: string) {
  return PROVIDERS.find((provider) => provider.test.test(url))?.name ?? null;
}

export function embedHtml(provider: string) {
  const rows = Array.from({ length: 10 }, (_, i) =>
    `<li><span>${String(i + 1).padStart(2, '0')}</span><b style="width:${38 + ((i * 17) % 45)}%"></b><em>${3 + (i % 4)}:${String((i * 13) % 60).padStart(2, '0')}</em></li>`
  ).join('');
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;height:100%;background:#151515;color:#c9c9c9;font:13px/1.2 Arial,sans-serif;overflow:hidden}
header{display:flex;gap:12px;align-items:center;padding:12px;border-bottom:1px solid #2a2a2a}
i{display:block;width:56px;height:56px;background:#333}
strong{display:block;color:#eee;font-size:14px;margin-bottom:6px}
ol{list-style:none;margin:0;padding:6px 12px}li{display:flex;gap:10px;align-items:center;height:26px;border-bottom:1px solid #222}
li span{width:20px;color:#777}li b{display:block;height:8px;background:#3a3a3a}li em{margin-left:auto;color:#777;font-style:normal}
</style></head><body><header><i></i><div><strong>${provider}</strong>Reproductor de respaldo local</div></header><ol>${rows}</ol></body></html>`;
}
