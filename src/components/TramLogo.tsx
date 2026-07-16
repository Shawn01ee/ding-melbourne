interface TramLogoProps {
  className?: string;
}

/** Original compact tram-front mark shared by the UI and browser favicon. */
export function TramLogo({ className = '' }: TramLogoProps) {
  return (
    <svg
      className={`tram-logo ${className}`.trim()}
      viewBox="0 0 64 64"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="32" cy="32" r="30" className="tram-logo-ground" />
      <path d="M25 13 29 7h6l4 6" className="tram-logo-pole" />
      <path d="M20 17c0-4 3-7 7-7h10c4 0 7 3 7 7v26c0 5-4 9-9 9h-6c-5 0-9-4-9-9V17Z" className="tram-logo-body" />
      <path d="M24 20c0-2 2-4 4-4h8c2 0 4 2 4 4v10H24V20Z" className="tram-logo-window-frame" />
      <path d="M27 19h4v8h-4zm6 0h4v8h-4z" className="tram-logo-window" />
      <path d="M25 35h14" className="tram-logo-bumper" />
      <circle cx="27" cy="41" r="2.5" className="tram-logo-lamp" />
      <circle cx="37" cy="41" r="2.5" className="tram-logo-lamp" />
      <path d="m24 53-3 5m19-5 3 5M19 58h8m10 0h8" className="tram-logo-rail" />
    </svg>
  );
}
