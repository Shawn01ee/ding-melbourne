import { describe, expect, it } from 'vitest';
import { inkForBackground } from '../src/brand';

describe('route badge contrast', () => {
  it('uses dark ink on bright Melbourne route colours', () => {
    expect(inkForBackground('#B5BD00')).toBe('#17211d');
    expect(inkForBackground('#FFB500')).toBe('#17211d');
    expect(inkForBackground('#969696')).toBe('#17211d');
  });

  it('keeps white ink on dark route colours and malformed fallbacks', () => {
    expect(inkForBackground('#C6007E')).toBe('#ffffff');
    expect(inkForBackground('not-a-colour')).toBe('#ffffff');
  });
});
