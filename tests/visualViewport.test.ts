import { describe, expect, it } from 'vitest';
import {
  appViewport,
  keyboardInset,
  stableKeyboardHeight,
} from '../src/app/visualViewport';

describe('mobile visual viewport', () => {
  it('detects a software keyboard only while the typing input is focused', () => {
    expect(appViewport(844, 500, 390, 0, true)).toMatchObject({
      height: 500,
      keyboardInset: 344,
      keyboardOpen: true,
    });
    expect(appViewport(844, 500, 390, 0, false).keyboardOpen).toBe(false);
  });

  it('does not mistake small browser chrome changes for a keyboard', () => {
    expect(appViewport(844, 760, 390, 0, true).keyboardOpen).toBe(false);
  });

  it('accounts for a visual viewport shifted inside the layout viewport', () => {
    expect(keyboardInset(844, 500, 44)).toBe(300);
    expect(appViewport(844, 500, 390, 44, true)).toMatchObject({
      offsetTop: 44,
      keyboardInset: 300,
      keyboardOpen: true,
    });
  });

  it('keeps the smallest height while a keyboard session remains open', () => {
    const initial = appViewport(844, 390, 402, 0, true);
    const autofillHidden = appViewport(844, 434, 402, 0, true);
    const autofillShown = appViewport(844, 378, 402, 0, true);

    expect(stableKeyboardHeight(null, initial)).toBe(390);
    expect(stableKeyboardHeight(390, autofillHidden)).toBe(390);
    expect(stableKeyboardHeight(390, autofillShown)).toBe(378);
  });

  it('releases the stable height when the keyboard closes', () => {
    const closed = appViewport(844, 844, 402, 0, true);
    expect(stableKeyboardHeight(390, closed)).toBeNull();
  });
});
