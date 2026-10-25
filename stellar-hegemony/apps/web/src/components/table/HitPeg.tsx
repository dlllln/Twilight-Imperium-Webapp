import type { ReactElement } from 'react';

/*
 * Ein roter Trefferstift: eigene Form aus Kopf, Schaft und Glanzlicht, keine fremde Grafik.
 * Er liegt im Stiftkasten der Kampfmatte, steckt in getroffenen Schiffen und folgt beim Ziehen
 * dem Zeiger.
 */
export function HitPeg(): ReactElement {
  return (
    <svg className="hit-peg" viewBox="0 0 16 28" aria-hidden="true">
      <path className="hit-peg-shaft" d="M6 12h4l-0.6 13.2a1.4 1.4 0 0 1-2.8 0z" />
      <circle className="hit-peg-head" cx="8" cy="8" r="6.5" />
      <ellipse className="hit-peg-shine" cx="5.8" cy="5.6" rx="2" ry="1.4" />
    </svg>
  );
}
