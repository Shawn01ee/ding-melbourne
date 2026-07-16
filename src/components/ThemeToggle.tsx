import type { ColorTheme } from '../storage/local';

interface ThemeToggleProps {
  theme: ColorTheme;
  onToggle: () => void;
  className?: string;
}

export function ThemeToggle({ theme, onToggle, className = '' }: ThemeToggleProps) {
  const night = theme === 'night';
  return (
    <button
      type="button"
      className={`theme-toggle ${className}`.trim()}
      aria-pressed={night}
      aria-label={`Switch to ${night ? 'day' : 'night'} mode`}
      onClick={onToggle}
    >
      <span className={`theme-toggle-icon ${night ? '' : 'active'}`} aria-hidden="true">☀</span>
      <span className={`theme-toggle-icon ${night ? 'active' : ''}`} aria-hidden="true">☾</span>
      <span className="theme-toggle-label">{night ? 'Night' : 'Day'}</span>
    </button>
  );
}
