import { describe, expect, it } from 'vitest';
import { appViewport, keyboardInset } from '../src/app/visualViewport';

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
});
