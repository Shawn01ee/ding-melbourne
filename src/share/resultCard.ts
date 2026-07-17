import { inkForBackground } from '../brand';

export interface ShareCardData {
  routeShort: string;
  routeLong: string;
  routeColor: string;
  headsign: string;
  modeLabel: string;
  rank: string;
  outcome: string;
  isNew: boolean;
  metrics: { label: string; value: string }[];
}

const CREAM = '#f6f5ef';
const CARD = '#ffffff';
const CHARCOAL = '#17211d';
const GREEN = '#0f7a3d';
const MUTED = '#68736c';
const LINE = '#e0e2d8';
const ACCENT = '#d0007f';
const FONT = 'Public Sans Variable';
const SITE_URL = 'ding-melbourne.vercel.app';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Renders an original, on-brand result card (1080×1080) as a PNG blob. */
export async function drawResultCard(data: ShareCardData): Promise<Blob> {
  const W = 1080;
  const H = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D unavailable');

  // Ensure the webfont is ready so canvas text renders in Public Sans.
  try {
    await document.fonts.load(`900 120px "${FONT}"`);
    await document.fonts.load(`700 40px "${FONT}"`);
    await document.fonts.ready;
  } catch {
    /* fall back to default sans */
  }

  const pad = 80;

  // Background + route colour top band.
  ctx.fillStyle = CREAM;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = data.routeColor;
  ctx.fillRect(0, 0, W, 16);

  // Header: brand kicker + wordmark.
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = GREEN;
  ctx.font = `800 26px "${FONT}"`;
  ctx.letterSpacing = '4px';
  ctx.fillText('MELBOURNE TRAM TYPING GAME', pad, 118);
  ctx.fillStyle = CHARCOAL;
  ctx.font = `900 52px "${FONT}"`;
  ctx.letterSpacing = '1px';
  ctx.fillText('DING! MELBOURNE', pad, 178);
  ctx.letterSpacing = '0px';

  // Route pill: badge + line name + direction.
  const pillY = 220;
  ctx.fillStyle = CARD;
  ctx.strokeStyle = LINE;
  ctx.lineWidth = 2;
  roundRect(ctx, pad, pillY, W - pad * 2, 128, 28);
  ctx.fill();
  ctx.stroke();
  const badgeR = 44;
  const badgeCx = pad + 40 + badgeR;
  const badgeCy = pillY + 64;
  ctx.fillStyle = data.routeColor;
  ctx.beginPath();
  ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = inkForBackground(data.routeColor);
  ctx.font = `900 ${data.routeShort.length > 2 ? 34 : 42}px "${FONT}"`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(data.routeShort, badgeCx, badgeCy + 2);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const textX = badgeCx + badgeR + 34;
  ctx.fillStyle = CHARCOAL;
  ctx.font = `800 40px "${FONT}"`;
  ctx.fillText(trim(ctx, data.routeLong, W - pad - textX), textX, pillY + 58);
  ctx.fillStyle = MUTED;
  ctx.font = `700 26px "${FONT}"`;
  ctx.fillText(trim(ctx, `${data.modeLabel} · → ${data.headsign}`, W - pad - textX), textX, pillY + 96);

  // Outcome + driver rank (the hero of the card).
  ctx.textAlign = 'center';
  ctx.fillStyle = MUTED;
  ctx.font = `800 28px "${FONT}"`;
  ctx.letterSpacing = '3px';
  ctx.fillText(data.outcome.toUpperCase(), W / 2, 470);
  ctx.letterSpacing = '0px';
  ctx.fillStyle = GREEN;
  ctx.font = `900 118px "${FONT}"`;
  ctx.fillText(trim(ctx, data.rank, W - pad * 2), W / 2, 590);

  if (data.isNew) {
    ctx.font = `800 26px "${FONT}"`;
    const label = 'NEW PERSONAL BEST';
    const w = ctx.measureText(label).width + 48;
    ctx.fillStyle = ACCENT;
    roundRect(ctx, (W - w) / 2, 620, w, 52, 26);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, W / 2, 648);
    ctx.textBaseline = 'alphabetic';
  }
  ctx.textAlign = 'left';

  // Metrics grid (2 columns).
  const cols = 2;
  const gridTop = 730;
  const gridGap = 20;
  const cellW = (W - pad * 2 - gridGap) / cols;
  const cellH = 110;
  data.metrics.slice(0, 4).forEach((m, i) => {
    const cx = pad + (i % cols) * (cellW + gridGap);
    const cy = gridTop + Math.floor(i / cols) * (cellH + gridGap);
    ctx.fillStyle = CARD;
    ctx.strokeStyle = LINE;
    ctx.lineWidth = 2;
    roundRect(ctx, cx, cy, cellW, cellH, 22);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = MUTED;
    ctx.font = `800 22px "${FONT}"`;
    ctx.letterSpacing = '2px';
    ctx.fillText(m.label.toUpperCase(), cx + 28, cy + 44);
    ctx.letterSpacing = '0px';
    ctx.fillStyle = CHARCOAL;
    ctx.font = `900 48px "${FONT}"`;
    ctx.fillText(m.value, cx + 28, cy + 92);
  });

  // Footer.
  ctx.fillStyle = MUTED;
  ctx.font = `700 26px "${FONT}"`;
  ctx.fillText("Miss your stop? Don't miss the spelling.", pad, H - 70);
  ctx.fillStyle = GREEN;
  ctx.font = `800 26px "${FONT}"`;
  ctx.textAlign = 'right';
  ctx.fillText(SITE_URL, W - pad, H - 70);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('toBlob failed'))), 'image/png');
  });
}

function trim(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxWidth) t = t.slice(0, -1);
  return t + '…';
}
