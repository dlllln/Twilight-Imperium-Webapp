import type { GameState } from '@stellar/domain';
import { Crown } from 'lucide-react';
import { type CSSProperties, type ReactElement, useMemo } from 'react';
import { finalStanding, type StandingRow, type TrackMarker, vpTrack } from '../../hud/vp-track.ts';
import { seatColor } from '../../seat-colors.ts';
import { useT } from '../../use-translation.ts';
import './victory-track.css';

/*
 * Die Siegpunktleiste unter der Auftragsleiste: Felder von 0 bis zum Ziel, darauf je Spieler eine
 * Scheibe in seiner Sitzfarbe. Wer wertet, dessen Scheibe gleitet ein Feld weiter (CSS-Übergang,
 * ohne Animationen springt sie). Ist die Partie entschieden, liegt der Endstand über der Leiste.
 */

type Translate = ReturnType<typeof useT>;

const markerText = (t: Translate, marker: TrackMarker, goal: number): string =>
  t('vpMarker')
    .replace('{name}', marker.name)
    .replace('{points}', String(marker.points))
    .replace('{goal}', String(goal));

/** Die Felder der Leiste; jedes fünfte ist hervorgehoben, das Ziel trägt eine Krone. */
function TrackFields({ goal }: { readonly goal: number }): ReactElement {
  return (
    <ol className="vp-track-fields" aria-hidden="true">
      {Array.from({ length: goal + 1 }, (_, field) => (
        <li key={field} data-fifth={field > 0 && field % 5 === 0} data-goal={field === goal}>
          {field === goal ? <Crown size={11} /> : field}
        </li>
      ))}
    </ol>
  );
}

/** Eine Scheibe: Lage über `--field` und `--stack`, damit der Übergang sie gleiten lässt. */
function Marker({ marker }: { readonly marker: TrackMarker }): ReactElement {
  const style = {
    '--seat': seatColor(marker.seat),
    '--field': marker.field,
    '--stack': marker.stack,
  } as CSSProperties;
  return <i className="vp-marker" data-player={marker.player} style={style} />;
}

/** Die Krone des Siegers; Bildschirmleser hören „Sieger“. */
function WinnerMark(): ReactElement {
  const t = useT();
  return (
    <>
      <Crown size={14} aria-hidden="true" className="vp-standing-crown" />
      <span className="sr-only">{t('winner')}</span>
    </>
  );
}

/** Eine Zeile des Endstands: Platz, Sitzfarbe, Name und Punkte; der Sieger mit Krone. */
function StandingLine({ row, goal }: { readonly row: StandingRow; readonly goal: number }) {
  const t = useT();
  return (
    <li data-winner={row.winner} style={{ '--seat': seatColor(row.seat) } as CSSProperties}>
      <span className="vp-standing-rank">{t('finalRank').replace('{rank}', String(row.rank))}</span>
      <i className="vp-standing-disc" aria-hidden="true" />
      <span className="vp-standing-name">
        {row.name} {row.winner && <WinnerMark />}
      </span>
      <strong>
        {row.points}/{goal}
      </strong>
    </li>
  );
}

/** Der Endstand über der Leiste, der Sieger zuerst. */
function Standing(props: { readonly rows: readonly StandingRow[]; readonly goal: number }) {
  const t = useT();
  return (
    <section className="vp-standing" role="region" aria-label={t('finalStanding')}>
      <h2>{t('finalStanding')}</h2>
      <ol>
        {props.rows.map((row) => (
          <StandingLine key={row.player} row={row} goal={props.goal} />
        ))}
      </ol>
    </section>
  );
}

/** Die Siegpunktleiste der Tischansicht samt Endstand am Ende der Partie. */
export function VictoryTrack({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const track = useMemo(() => vpTrack(game), [game]);
  const over = game.phase === 'gameOver';
  return (
    <section
      className="vp-track"
      aria-label={t('vpTrack')}
      data-tutorial="vp-track"
      style={{ '--fields': track.goal + 1 } as CSSProperties}
    >
      <TrackFields goal={track.goal} />
      <div className="vp-track-markers" aria-hidden="true">
        {track.markers.map((marker) => (
          <Marker key={marker.player} marker={marker} />
        ))}
      </div>
      <ul className="sr-only">
        {track.markers.map((marker) => (
          <li key={marker.player}>{markerText(t, marker, track.goal)}</li>
        ))}
      </ul>
      {over && <Standing rows={finalStanding(game)} goal={track.goal} />}
    </section>
  );
}
