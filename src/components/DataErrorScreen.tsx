import { BRAND } from '../brand';

/** Explicit data-failure UI — malformed route JSON must never fail silently (AC-09). */
export function DataErrorScreen({ problems }: { problems: string[] }) {
  return (
    <main className="screen error-screen" role="alert">
      <p className="brand">{BRAND}</p>
      <h1>Route data problem</h1>
      <p>The route file failed validation, so the game can't start. Details:</p>
      <ul>
        {problems.map((p, i) => (
          <li key={i}>{p}</li>
        ))}
      </ul>
      <p>Regenerate the route JSON and reload.</p>
    </main>
  );
}
