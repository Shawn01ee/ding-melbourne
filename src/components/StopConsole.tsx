import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { charStatuses } from '../game/normalize';
import type { GameAction, GameState } from '../game/reducer';
import { targetText } from '../game/reducer';
import { currentStop, nextStop, previousStop, stopShortName } from '../game/selectors';
import { StatCard } from './StatCard';

interface StopConsoleProps {
  state: GameState;
  dispatch: (action: GameAction) => void;
}

export function StopConsole({ state, dispatch }: StopConsoleProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);
  const [shake, setShake] = useState(false);
  const prevErrorsRef = useRef(state.errors);

  const target = targetText(state);
  const statuses = charStatuses(state.input, target, state.config.difficulty);
  const targetChars = [...target];
  const extras = [...state.input].slice(targetChars.length);
  const cursorIndex = [...state.input].length;

  const prev = previousStop(state);
  const current = currentStop(state);
  const next = nextStop(state);
  const typingActive = state.phase === 'typing' || state.phase === 'ready';
  const routeColor = state.route.route.color;

  // Auto-focus when a stop opens for typing (AC-01) and keep focus per stop.
  useEffect(() => {
    if (typingActive) inputRef.current?.focus();
  }, [typingActive, state.stopIndex]);

  // 80ms micro-shake on new errors (PRD §6); disabled under reduced motion via CSS.
  useEffect(() => {
    if (state.errors > prevErrorsRef.current) {
      setShake(true);
      const t = setTimeout(() => setShake(false), 120);
      prevErrorsRef.current = state.errors;
      return () => clearTimeout(t);
    }
    prevErrorsRef.current = state.errors;
  }, [state.errors]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (state.phase === 'ready' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      dispatch({ type: 'DEPART', at: Date.now() });
    }
  };

  // Keep the whole stop name on one line: shrink the font until it fits.
  const charsRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = charsRef.current;
    if (!el) return;
    const fit = () => {
      el.style.fontSize = '';
      for (let i = 0; i < 4 && el.scrollWidth > el.clientWidth; i++) {
        const base = parseFloat(getComputedStyle(el).fontSize);
        const next = Math.max(12, (base * el.clientWidth) / el.scrollWidth - 0.5);
        el.style.fontSize = `${next}px`;
        if (next <= 12) break;
      }
    };
    fit();
    // Re-measure when the box resizes and once webfonts land (metrics shift).
    const observer = new ResizeObserver(fit);
    observer.observe(el);
    document.fonts?.ready.then(fit).catch(() => {});
    return () => observer.disconnect();
  }, [target, extras.length]);

  return (
    <section className={`console${shake ? ' shake' : ''}`} aria-label="Typing console">
      <StatCard state={state} />
      <div className="console-bar" style={{ background: routeColor }}>
        <div className="bar-side bar-prev">
          {prev && (
            <>
              {prev.stopNumber && <span className="roundel">#{prev.stopNumber}</span>}
              <div className="side-text">
                <span className="side-label">Previous</span>
                <span className="side-name">{stopShortName(prev)}</span>
              </div>
            </>
          )}
        </div>

        <div
          className={`stop-slot stop-current${state.phase === 'ready' ? ' complete' : ''}${
            typingActive && !focused ? ' unfocused' : ''
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          {current.stopNumber && (
            <span className="capsule-roundel" style={{ background: routeColor }}>
              #{current.stopNumber}
            </span>
          )}
          <div className="capsule-main">
            <div className="target-chars" aria-hidden="true" ref={charsRef}>
              {targetChars.map((c, i) => (
                <span
                  key={i}
                  className={`ch ch-${statuses[i]}${
                    typingActive && focused && i === cursorIndex ? ' ch-cursor' : ''
                  }`}
                >
                  {c}
                </span>
              ))}
              {extras.map((c, i) => (
                <span key={`x${i}`} className="ch ch-wrong ch-extra">
                  {c}
                </span>
              ))}
            </div>
            <div className="char-track" aria-hidden="true">
              {targetChars.map((c, i) => (
                <span key={i} className={c === ' ' ? 'dash dash-space' : `dash dash-${statuses[i]}`} />
              ))}
            </div>
            <div className="capsule-sub">{current.displayName}</div>
          </div>
          <input
            ref={inputRef}
            className="ghost-input"
            type="text"
            value={state.input}
            aria-label={`Type the stop name: ${current.displayName}`}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            spellCheck={false}
            readOnly={!typingActive}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(e) => {
              // Dispatch every change, including mid-IME-composition updates:
              // freezing the controlled value here silently swallows composed input.
              dispatch({ type: 'INPUT', value: e.target.value, at: Date.now() });
            }}
            onCompositionEnd={(e) => {
              dispatch({ type: 'INPUT', value: e.currentTarget.value, at: Date.now() });
            }}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              e.preventDefault();
              dispatch({ type: 'INVALID_ACTION' });
            }}
          />
        </div>

        <div className="bar-side bar-next">
          {next ? (
            <>
              <div className="side-text side-text-right">
                <span className="side-label">Next stop</span>
                <span className="side-name">{stopShortName(next)}</span>
              </div>
              {next.stopNumber && <span className="roundel">#{next.stopNumber}</span>}
            </>
          ) : (
            <div className="side-text side-text-right">
              <span className="side-label">Terminus</span>
              <span className="side-name">End of the line</span>
            </div>
          )}
          <span className={`bar-arrow${state.phase === 'ready' ? ' go' : ''}`} aria-hidden="true">
            →
          </span>
        </div>
      </div>

      <p
        className={`console-hint${state.phase === 'ready' ? ' ready' : ''}${
          typingActive && !focused ? ' warn' : ''
        }`}
        aria-live="polite"
      >
        {typingActive && !focused
          ? 'Click the stop name box, then type'
          : state.phase === 'ready'
            ? 'Ding! Press Enter or Space to depart'
            : `Type the current stop name (${state.config.difficulty})`}
      </p>
    </section>
  );
}
