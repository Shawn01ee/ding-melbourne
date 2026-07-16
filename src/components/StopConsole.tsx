import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { inkForBackground } from '../brand';
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
  const typingActive = state.phase === 'typing';
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
    if (!typingActive || e.nativeEvent.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.key === 'Backspace') {
      e.preventDefault();
      dispatch({ type: 'INPUT', value: [...state.input].slice(0, -1).join(''), at: Date.now() });
      return;
    }
    if (e.key.length === 1) {
      // Drive the game from accepted characters rather than the browser's raw
      // text value. Wrong keys are counted by the reducer but never stick.
      e.preventDefault();
      dispatch({ type: 'INPUT', value: state.input + e.key, at: Date.now() });
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
      <p
        className={`console-hint${typingActive && !focused ? ' warn' : ''}`}
        aria-live="polite"
      >
        {typingActive && !focused ? (
          'Click the stop name box, then type'
        ) : (
          <><kbd>TYPE</kbd> Wrong keys do not stick · complete the stop to ring the bell</>
        )}
      </p>
      <span className="sr-only" aria-live="polite">
        Stop {state.stopsCompleted + 1}: {current.displayName}
      </span>

      <div
        className="console-bar"
        style={{ '--route-color': routeColor } as CSSProperties}
      >
        <div className="bar-side bar-prev">
          {prev ? (
            <>
              <span className="bar-arrow bar-arrow-back" aria-hidden="true">←</span>
              {prev.stopNumber && <span className="roundel">#{prev.stopNumber}</span>}
              <div className="side-text">
                <span className="side-label">Previous</span>
                <span className="side-name">{stopShortName(prev)}</span>
              </div>
            </>
          ) : (
            <>
              <span className="bar-arrow bar-arrow-back" aria-hidden="true">←</span>
              <div className="side-text">
                <span className="side-label">Route {state.route.route.shortName}</span>
                <span className="side-name">Start of run</span>
              </div>
            </>
          )}
        </div>

        <div
          className={`stop-slot typing-stop${state.input ? ' has-progress' : ''}${
            typingActive && !focused ? ' unfocused' : ''
          }`}
          onClick={() => inputRef.current?.focus()}
        >
          {current.stopNumber && (
            <span
              className="capsule-roundel"
              style={{ background: routeColor, color: inkForBackground(routeColor) }}
            >
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
            enterKeyHint="next"
            inputMode="text"
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
          <span className={`bar-arrow${state.input ? ' go' : ''}`} aria-hidden="true">
            →
          </span>
        </div>
      </div>
    </section>
  );
}
