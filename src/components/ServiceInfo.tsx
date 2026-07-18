import type { ReactNode } from 'react';
import type { ColorTheme } from '../storage/local';
import { BRAND } from '../brand';
import { ThemeToggle } from './ThemeToggle';
import { TramLogo } from './TramLogo';

export type InfoPageId =
  | 'play'
  | 'guide'
  | 'faq'
  | 'about'
  | 'accessibility'
  | 'privacy'
  | 'terms'
  | 'data';

export const INFO_NAV_ITEMS: readonly { id: InfoPageId; label: string }[] = [
  { id: 'play', label: 'How to play' },
  { id: 'guide', label: 'Typing guide' },
  { id: 'faq', label: 'FAQ' },
  { id: 'about', label: 'About' },
  { id: 'accessibility', label: 'Accessibility' },
  { id: 'privacy', label: 'Privacy' },
  { id: 'terms', label: 'Terms' },
  { id: 'data', label: 'Data & credits' },
] as const;

export function infoPageFromHash(hash: string): InfoPageId | null {
  const page = hash.replace(/^#\/?/, '');
  return INFO_NAV_ITEMS.some((item) => item.id === page) ? page as InfoPageId : null;
}

interface ServiceInfoProps {
  page: InfoPageId;
  theme: ColorTheme;
  onNavigate: (page: InfoPageId) => void;
  onClose: () => void;
  onToggleTheme: () => void;
}

interface PageCopy {
  eyebrow: string;
  title: string;
  lede: string;
  content: ReactNode;
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="info-section">
      <h2><span aria-hidden="true" />{title}</h2>
      {children}
    </section>
  );
}

function Steps({ children }: { children: ReactNode }) {
  return <ol className="info-steps">{children}</ol>;
}

function Step({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li>
      <span className="info-step-marker" aria-hidden="true" />
      <div><strong>{title}</strong><p>{children}</p></div>
    </li>
  );
}

function Note({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="info-note">
      <strong>{title}</strong>
      <p>{children}</p>
    </aside>
  );
}

function Qa({ question, children }: { question: string; children: ReactNode }) {
  return (
    <article className="info-qa">
      <h3>{question}</h3>
      <div>{children}</div>
    </article>
  );
}

const PAGE_COPY: Record<InfoPageId, PageCopy> = {
  play: {
    eyebrow: 'Passenger information 01',
    title: 'How to drive the line',
    lede: 'Choose a Melbourne tram service, type each stop, and keep the tram moving without waiting for a separate departure key.',
    content: (
      <>
        <Section title="Your first run">
          <Steps>
            <Step title="Choose a route">Pick one of the 24 current tram routes. The coloured badge matches that route throughout the game.</Step>
            <Step title="Set the journey">Choose a direction and any start stop before the terminus. The preview shows where you board and where the run ends.</Step>
            <Step title="Choose a mode">Full Route reaches the terminus, 10-Stop Section is a shorter session, and 60s Sprint measures how far you can travel in one minute.</Step>
            <Step title="Type continuously">Every correct character moves the tram. A wrong key counts as a miss but does not enter the word or block the next key.</Step>
            <Step title="Clear the stop">The next stop opens immediately when the name is complete. There is no Enter or Space departure step.</Step>
          </Steps>
          <Note title="Start somewhere familiar">Your most recent route and setup are kept in this browser, so the next visit can begin from the same service.</Note>
        </Section>
        <Section title="Modes at a glance">
          <div className="info-table-wrap">
            <table>
              <thead><tr><th>Mode</th><th>Journey</th><th>Good for</th></tr></thead>
              <tbody>
                <tr><td>Full Route</td><td>Start stop to terminus</td><td>Route knowledge and endurance</td></tr>
                <tr><td>10-Stop Section</td><td>The next ten stops</td><td>A focused daily session</td></tr>
                <tr><td>60s Sprint</td><td>As many stops as possible</td><td>Cadence and repeatable benchmarks</td></tr>
              </tbody>
            </table>
          </div>
        </Section>
        <Section title="Difficulty">
          <div className="info-card-grid two">
            <Qa question="Standard">Types the shorter, practice-friendly stop name—usually the street or landmark before a slash.</Qa>
            <Qa question="Driver">Types the complete generated stop name, including intersection detail and spacing.</Qa>
          </div>
        </Section>
      </>
    ),
  },
  guide: {
    eyebrow: 'Driver learning guide',
    title: 'Build clean tram-driving rhythm',
    lede: 'Accuracy moves the tram. Speed follows when the next character, space, and street pattern become predictable.',
    content: (
      <>
        <Section title="A useful ten-minute session">
          <Steps>
            <Step title="Warm up in Standard">Run a 10-stop section at a pace where each key is deliberate.</Step>
            <Step title="Repeat the same section">Keep the route, direction, and start stop unchanged so the result is comparable.</Step>
            <Step title="Switch one variable">Try Driver difficulty or move the start stop. Avoid changing every setting at once.</Step>
            <Step title="Finish with a sprint">Use 60s Sprint only after the stop patterns feel familiar.</Step>
          </Steps>
        </Section>
        <Section title="Read the driving instruments">
          <div className="info-card-grid">
            <Qa question="Combo">Rises with every correct character and resets on a miss. It rewards a clean sequence rather than one completed stop.</Qa>
            <Qa question="WPM">Uses the conventional five-character word. Treat it as cadence, not a measure of route knowledge.</Qa>
            <Qa question="Accuracy">Correct keystrokes divided by all attempted keystrokes. Improving this first usually produces steadier WPM.</Qa>
            <Qa question="Score">Combines correct input, accuracy, and progress. Compare runs made with the same route, direction, mode, difficulty, and start stop.</Qa>
          </div>
        </Section>
        <Section title="Street-name technique">
          <ul className="info-list">
            <li>Read one chunk ahead: name, space, road suffix, then the next street.</li>
            <li>Let an error go. The wrong key does not stick, so the correct key can follow immediately.</li>
            <li>Use Standard to learn the place, then Driver to practise the full intersection.</li>
            <li>Short, accurate repeats are more useful than forcing one exhausted full-route run.</li>
          </ul>
        </Section>
      </>
    ),
  },
  faq: {
    eyebrow: 'Frequently asked questions',
    title: 'Before the bell rings',
    lede: 'Answers about stops, scoring, saved progress, phones, sound, and the network data used by the game.',
    content: (
      <>
        <Section title="Playing">
          <div className="info-card-grid">
            <Qa question="Do I have to start at the terminus?">No. Select any listed start stop. The final terminus cannot be a start because every run needs at least one hop.</Qa>
            <Qa question="Why did my wrong letter disappear?">That is intentional. It is recorded as a miss and resets the combo, but the input stays at the last correct character.</Qa>
            <Qa question="Can I play on a phone?">Yes. Add the site to your home screen for an app-style full-screen launch. While the device keyboard is open, the cockpit compacts itself so the destination board, tram, stats, and typing target remain visible. A physical keyboard is still better for sustained practice.</Qa>
            <Qa question="Can I mute the game?">Yes. Bell on/off is part of the setup and all movement remains immediate when sound is disabled.</Qa>
          </div>
        </Section>
        <Section title="Progress and service">
          <div className="info-card-grid">
            <Qa question="Do I need an account?">No. Sign-in is optional and only enables the public leaderboard. Settings and personal bests continue to stay in this browser.</Qa>
            <Qa question="Will my results move to another device?">Local settings and personal bests do not sync. Signed-in leaderboard records are available from other devices, but they do not replace the local personal-best history.</Qa>
            <Qa question="Are these live tram positions?">No. The map is a game view built from scheduled route and stop data, not live operations or journey planning.</Qa>
            <Qa question="How current is the network?">The bundled metropolitan tram network was generated from the Transport Victoria GTFS Schedule dated 10 July 2026.</Qa>
          </div>
        </Section>
      </>
    ),
  },
  about: {
    eyebrow: 'About the project',
    title: 'Melbourne, one stop at a time',
    lede: 'DING! MELBOURNE turns the city’s tram-stop vocabulary into a continuous typing journey across the full metropolitan network.',
    content: (
      <>
        <Section title="Why trams and typing belong together">
          <p>Stop names have rhythm: streets, landmarks, junctions, and suburbs repeat across a line while the city changes around them. The game uses that natural sequence as a learning path rather than serving unrelated words.</p>
          <p>The tram only advances on correct input, but a mistake never traps the player. That keeps the journey legible and the typing loop uninterrupted.</p>
        </Section>
        <Section title="What is original here">
          <div className="info-card-grid">
            <Qa question="Melbourne-first interaction">Route choice, direction, stop sequence, network overview, and journey report are designed around this tram system.</Qa>
            <Qa question="Original presentation">The tram mark, cockpit, schematic geography, motion, and synthesised sounds were created for this project.</Qa>
            <Qa question="Public-data transformation">Official schedule data is validated and converted into compact, game-ready route files rather than displayed as a journey planner.</Qa>
            <Qa question="Independent project">This is a fan-made game and is not affiliated with or endorsed by Transport Victoria, the Department of Transport and Planning, or Yarra Trams.</Qa>
          </div>
        </Section>
        <Section title="Optional online features">
          <p>The game still works without registration. When the optional backend is enabled, signing in adds a public leaderboard and a driver profile; local settings and personal bests remain local. Ghost challenges and private races are planned as later multiplayer phases.</p>
        </Section>
      </>
    ),
  },
  accessibility: {
    eyebrow: 'Access & comfort',
    title: 'A clearer ride for more players',
    lede: 'The current release supports keyboard-first play, visible focus, day and night palettes, optional sound, and reduced-motion preferences.',
    content: (
      <>
        <Section title="Available now">
          <div className="info-card-grid">
            <Qa question="Keyboard-first flow">Configuration controls use native buttons, radio roles, labels, and selects. During play, correct characters are accepted without a mouse.</Qa>
            <Qa question="Visible state">Selection and focus have non-colour outlines. Correct, current, and wrong characters also differ by shape or decoration.</Qa>
            <Qa question="Motion and sound">The site respects reduced-motion preferences. Sound can be disabled without changing timing, scoring, or progression.</Qa>
            <Qa question="Contrast choices">Day and night themes preserve route colour while keeping text and controls on contrasting surfaces.</Qa>
          </div>
        </Section>
        <Section title="Known limitations">
          <p>The animated geographic map is primarily visual, and long stop names can require horizontal visual scanning. A full screen-reader driving mode and user-adjustable text scale are not yet complete.</p>
          <Note title="Practical option">Use Standard difficulty for shorter targets, mute sound if cues are distracting, and enable reduced motion in your operating system if map animation is uncomfortable.</Note>
        </Section>
      </>
    ),
  },
  privacy: {
    eyebrow: 'Privacy notice',
    title: 'You choose what leaves this device',
    lede: 'DING! MELBOURNE plays with no ads, analytics SDK, or trackers. Signing in is optional and only powers the online leaderboard. Last updated 18 Jul 2026.',
    content: (
      <>
        <Section title="Local-only by default">
          <p>Without signing in, the game keeps a few items in this browser’s <code>localStorage</code> and never uploads them:</p>
          <div className="info-table-wrap">
            <table>
              <thead><tr><th>Browser item</th><th>Why it is kept</th></tr></thead>
              <tbody>
                <tr><td>Theme and sound</td><td>Restore the display and audio preference on the next visit.</td></tr>
                <tr><td>Last route and setup</td><td>Return to the same direction, mode, difficulty, and start stop.</td></tr>
                <tr><td>Personal bests</td><td>Compare runs made with the same configuration.</td></tr>
              </tbody>
            </table>
          </div>
          <p>Clear this site’s data in your browser to remove them. Private browsing or restricted storage may prevent results from being retained.</p>
        </Section>
        <Section title="If you sign in (optional)">
          <p>Signing in is needed only to post scores to the public leaderboard. You can use Google, or an email magic link — either way we never receive a password.</p>
          <div className="info-table-wrap">
            <table>
              <thead><tr><th>Collected when signed in</th><th>Purpose</th></tr></thead>
              <tbody>
                <tr><td>Account id and email address</td><td>Identify your account and send the magic-link sign-in email.</td></tr>
                <tr><td>Google profile name and avatar (Google sign-in only)</td><td>Suggest a starting display name and picture.</td></tr>
                <tr><td>The display name you choose</td><td>Shown publicly next to your leaderboard entries.</td></tr>
                <tr><td>Run records (route, mode, difficulty, time, WPM, accuracy, score, date)</td><td>Rank runs on the public leaderboard.</td></tr>
                <tr><td>Sign-in session token</td><td>Kept in this browser so you stay signed in.</td></tr>
              </tbody>
            </table>
          </div>
          <p>Your chosen display name and submitted run records are <strong>public</strong> to anyone viewing the leaderboard.</p>
        </Section>
        <Section title="Who processes this data">
          <ul className="info-list">
            <li><strong>Supabase</strong> (Supabase Inc.) hosts the sign-in and the leaderboard database on our behalf.</li>
            <li><strong>Google</strong> processes the sign-in only when you choose “Sign in with Google”.</li>
          </ul>
          <p>These providers may store data on servers outside your country. The game uses no advertising, analytics, or third-party tracking.</p>
        </Section>
        <Section title="Keeping and deleting your data">
          <p>Leaderboard records are kept until you remove your app profile and records or a scheduled leaderboard reset clears the board. The sign-in provider may retain the underlying authentication identity separately.</p>
          <Note title="Your controls">Use Driver profile → Delete account data to remove this app’s public profile and scores, sign out at any time, or clear this site’s browser data to remove local preferences and bests. For deletion of the underlying authentication identity, contact <a href="mailto:leesmofficial01@gmail.com">leesmofficial01@gmail.com</a>.</Note>
        </Section>
        <Section title="Security and younger players">
          <p>Traffic is served over HTTPS. Leaderboard rows are write-protected by database row-level security and validated on the server, so the browser cannot post scores directly. If you are under the age of consent in your country, please play without signing in.</p>
        </Section>
      </>
    ),
  },
  terms: {
    eyebrow: 'Project terms',
    title: 'Play fair, travel independently',
    lede: 'These concise terms describe the current fan-made game. They do not replace the terms of any transport operator or data provider.',
    content: (
      <>
        <Section title="Using the game">
          <ul className="info-list">
            <li>Use the site for personal play, learning, demonstration, and classroom practice.</li>
            <li>Do not interfere with the service or attempt unauthorised access.</li>
            <li>Do not present the project, its original artwork, or its interface as an official Transport Victoria or Yarra Trams product.</li>
          </ul>
        </Section>
        <Section title="Accounts and the leaderboard">
          <p>Signing in is optional and only enables the public leaderboard. Choose a display name suitable for a public board, and post only your own genuine play.</p>
          <p>Automated input, scripts, shared answers, or tampering may have records removed and the account suspended. We may also reset the board or adjust rankings to keep them fair. You can remove your app profile and leaderboard records at any time.</p>
        </Section>
        <Section title="No journey-planning warranty">
          <p>The game may simplify, merge, shorten, or rearrange public transport data for play. It does not provide live disruption advice, accessibility information, fares, timetables, or a safe walking route.</p>
          <p>Use official transport channels when planning real travel. The game is provided as-is and may change or be unavailable without notice.</p>
        </Section>
        <Section title="Rights and third-party data">
          <p>Original code, interface, illustrations, and synthesised audio remain part of this project. Transport data remains subject to its source licence and attribution. External names and marks belong to their respective owners.</p>
        </Section>
      </>
    ),
  },
  data: {
    eyebrow: 'Data & credits',
    title: 'From timetable feed to typing line',
    lede: 'The game converts public schedule data into validated stop sequences, lightweight maps, and answer text designed for continuous typing.',
    content: (
      <>
        <Section title="Current network snapshot">
          <div className="info-facts">
            <div><strong>24</strong><span>tram routes</span></div>
            <div><strong>10 Jul 2026</strong><span>GTFS source date</span></div>
            <div><strong>CC BY 4.0</strong><span>data licence</span></div>
          </div>
          <p>Contains public transport data supplied by the Victorian Department of Transport and Planning.</p>
          <p><a href="https://opendata.transport.vic.gov.au/dataset/gtfs-schedule" target="_blank" rel="noreferrer">Transport Victoria GTFS Schedule ↗</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer">Creative Commons Attribution 4.0 ↗</a></p>
        </Section>
        <Section title="How the feed becomes a game">
          <Steps>
            <Step title="Select metropolitan trams">The preprocessing pipeline isolates the current tram routes, stops, trips, and geographic shapes.</Step>
            <Step title="Validate and order stops">Directions are checked, duplicate stop records are normalised, and every playable run keeps a deterministic sequence.</Step>
            <Step title="Create typing answers">Generated stop labels are transformed into Standard and Driver targets while preserving the source display name.</Step>
            <Step title="Ship lightweight route files">A small network index loads first; detailed route data is fetched only when that line is selected.</Step>
          </Steps>
        </Section>
        <Section title="Important limits">
          <p>The network overview is an original schematic geographic treatment. It is not the official tram map, does not show every street or landmark, and should not be used to verify live operations.</p>
          <p>All tram illustrations, interface graphics, animations, and sounds in the game are original project work; no operator recordings or official map artwork are bundled.</p>
        </Section>
      </>
    ),
  },
};

export function ServiceInfo({ page, theme, onNavigate, onClose, onToggleTheme }: ServiceInfoProps) {
  const copy = PAGE_COPY[page];

  return (
    <main className="screen info-screen">
      <svg className="info-network" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
        <path d="M-80 760 L280 570 L530 640 L820 410 L1110 490 L1510 260" />
        <path d="M70 -50 L250 260 L170 500 L430 930" />
        <path d="M1030 -80 L970 240 L1130 570 L1030 970" />
      </svg>

      <header className="info-topbar">
        <button type="button" className="info-home" onClick={onClose} aria-label="Back to game setup">
          <TramLogo />
          <span>{BRAND}</span>
        </button>
        <nav className="info-nav" aria-label="Passenger information">
          {INFO_NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-current={item.id === page ? 'page' : undefined}
              onClick={() => onNavigate(item.id)}
            >
              {item.label}
            </button>
          ))}
        </nav>
        <ThemeToggle theme={theme} onToggle={onToggleTheme} className="info-theme-toggle" />
      </header>

      <article className="info-document">
        <button type="button" className="info-back" onClick={onClose}>← Back to tram setup</button>
        <header className="info-document-header">
          <p>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <div>{copy.lede}</div>
          <small>Service notes checked 16 July 2026</small>
        </header>
        <div className="info-document-body">{copy.content}</div>
      </article>

      <footer className="info-page-footer">
        <p><strong>{BRAND}</strong> · Independent fan-made Melbourne tram typing game.</p>
        <button type="button" onClick={onClose}>Return to the driver’s cab →</button>
      </footer>
    </main>
  );
}
