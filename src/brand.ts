/** Working brand name, isolated as constants (PRD §4 — final name TBD). */
export const BRAND = 'DING! MELBOURNE';
export const TAGLINE = "Miss your stop? Don't miss the spelling.";

function relativeLuminance(hex: string): number | null {
  const value = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(value)) return null;
  const channels = [0, 2, 4].map((offset) => Number.parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((channel) =>
    channel <= 0.04045 ? channel / 12.92 : Math.pow((channel + 0.055) / 1.055, 2.4),
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

/** Pick whichever brand ink has stronger WCAG contrast with a route colour. */
export function inkForBackground(hex: string): '#17211d' | '#ffffff' {
  const background = relativeLuminance(hex);
  if (background === null) return '#ffffff';

  const darkInk = '#17211d';
  const darkLuminance = relativeLuminance(darkInk) ?? 0;
  const darkContrast = (background + 0.05) / (darkLuminance + 0.05);
  const whiteContrast = 1.05 / (background + 0.05);
  return darkContrast >= whiteContrast ? darkInk : '#ffffff';
}
