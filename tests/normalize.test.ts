import { describe, expect, it } from 'vitest';
import { charStatuses, isAnswerMatch, normalizeBase, normalizeForCompare } from '../src/game/normalize';

describe('normalizeBase', () => {
  it('applies NFKC, trim, lowercase and collapses whitespace', () => {
    expect(normalizeBase('  Ｂｏｕｒｋｅ   Street  MALL ')).toBe('bourke street mall');
  });

  it('collapses double spaces into one (PRD §8 case table)', () => {
    expect(normalizeBase('St  Kilda   Station')).toBe('st kilda station');
  });
});

describe('isAnswerMatch — standard', () => {
  const answers = ['St Kilda Station/Fitzroy St'];

  it('accepts case differences', () => {
    expect(isAnswerMatch('st kilda station/fitzroy st', answers, 'standard')).toBe(true);
    expect(isAnswerMatch('ST KILDA STATION/FITZROY ST', answers, 'standard')).toBe(true);
  });

  it('treats punctuation as optional', () => {
    expect(isAnswerMatch('st kilda station fitzroy st', answers, 'standard')).toBe(true);
  });

  it('unifies curly apostrophes', () => {
    expect(isAnswerMatch('luna park’s gate', ["Luna Park's Gate"], 'standard')).toBe(true);
  });

  it('rejects wrong names and empty input', () => {
    expect(isAnswerMatch('st kilda beach', answers, 'standard')).toBe(false);
    expect(isAnswerMatch('   ', answers, 'standard')).toBe(false);
  });

  it('never auto-aliases St and Street (would corrupt proper nouns, PRD §8)', () => {
    expect(isAnswerMatch('Street Kilda Station/Fitzroy Street', answers, 'standard')).toBe(false);
    expect(isAnswerMatch('Bourke St Mall/Bourke St', ['Bourke Street Mall/Bourke St'], 'standard')).toBe(false);
  });
});

describe('isAnswerMatch — driver', () => {
  const answers = ['St Kilda Station/Fitzroy St #132'];

  it('requires punctuation and stop number', () => {
    expect(isAnswerMatch('st kilda station fitzroy st 132', answers, 'driver')).toBe(false);
    expect(isAnswerMatch('St Kilda Station/Fitzroy St', answers, 'driver')).toBe(false);
  });

  it('still ignores case and extra whitespace', () => {
    expect(isAnswerMatch('st kilda station/fitzroy st #132', answers, 'driver')).toBe(true);
    expect(isAnswerMatch('  st kilda   station/fitzroy st #132 ', answers, 'driver')).toBe(true);
  });
});

describe('normalizeForCompare', () => {
  it('keeps punctuation on driver, folds it elsewhere', () => {
    expect(normalizeForCompare('A/B #1', 'driver')).toBe('a/b #1');
    expect(normalizeForCompare('A/B #1', 'standard')).toBe('a b 1');
  });
});

describe('charStatuses', () => {
  it('marks correct, wrong and pending positions', () => {
    expect(charStatuses('boU', 'Bourke', 'standard')).toEqual([
      'correct',
      'correct',
      'correct',
      'pending',
      'pending',
      'pending',
    ]);
    expect(charStatuses('bx', 'Bourke', 'standard')[1]).toBe('wrong');
  });

  it('accepts a space typed where the target shows folded punctuation (non-driver)', () => {
    expect(charStatuses('a ', 'a/', 'standard')[1]).toBe('correct');
    expect(charStatuses('a ', 'a/', 'driver')[1]).toBe('wrong');
  });
});
