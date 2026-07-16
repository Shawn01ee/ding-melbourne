export const KEYBOARD_OPEN_THRESHOLD = 120;

export interface AppViewport {
  height: number;
  width: number;
  offsetTop: number;
  keyboardInset: number;
  keyboardOpen: boolean;
}

export function keyboardInset(
  baselineHeight: number,
  visibleHeight: number,
  offsetTop = 0,
): number {
  return Math.max(0, Math.round(baselineHeight - visibleHeight - offsetTop));
}

export function appViewport(
  baselineHeight: number,
  visibleHeight: number,
  visibleWidth: number,
  offsetTop: number,
  typingInputFocused: boolean,
): AppViewport {
  const inset = keyboardInset(baselineHeight, visibleHeight, offsetTop);
  return {
    height: Math.max(1, Math.round(visibleHeight)),
    width: Math.max(1, Math.round(visibleWidth)),
    offsetTop: Math.max(0, Math.round(offsetTop)),
    keyboardInset: inset,
    keyboardOpen: typingInputFocused && inset >= KEYBOARD_OPEN_THRESHOLD,
  };
}

/**
 * iOS can add/remove its QuickType or AutoFill row while an input stays
 * focused. Keep the smallest keyboard-open height for that focus session so
 * the cockpit does not bounce at every stop. Reset when the keyboard closes.
 */
export function stableKeyboardHeight(
  currentHeight: number | null,
  viewport: AppViewport,
): number | null {
  if (!viewport.keyboardOpen) return null;
  return Math.min(currentHeight ?? viewport.height, viewport.height);
}
