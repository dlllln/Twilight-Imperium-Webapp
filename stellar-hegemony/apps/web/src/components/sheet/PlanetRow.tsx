import type { GameState } from '@stellar/domain';
import { Star } from 'lucide-react';
import { type CSSProperties, type ReactElement, useMemo } from 'react';
import { PLANET_ART_CROPS } from '../../artwork/planets.ts';
import { useViewer } from '../../game-store.ts';
import {
  type CardTurn,
  cardTurn,
  type PlanetCardView,
  planetCardText,
  planetRow,
  type RowMode,
} from '../../hud/planet-row.ts';
import type { SheetTable } from '../../hud/use-sheet.ts';
import type { PlanetLook } from '../../render/planet-texture.ts';
import { content } from '../../store.ts';
import { useRegisterPlanetRow } from '../../table/payment-store.ts';
import { kasseUseful, type PlanetTable, planetStates } from '../../table/planet-table.ts';
import { planetTarget, targetKey, type TargetState } from '../../table/target-ref.ts';
import { usePlanetTable } from '../../table/use-planet-table.ts';
import { useOfferedGoods } from '../../table/use-trade-mat.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { KassePlate } from './KassePlate.tsx';
import './planet-row.css';

/*
 * Die Planetenreihe auf dem Schatzflügel: eigene Planeten als Karten vor dem eigenen Platz. In
 * Ruhe ragen sie nur als schmaler Streifen hervor. Eine offene Bezahlung oder das Bereitmachen
 * hebt sie an: Angebotene Karten werden zu Kontrollkästchen, ein Tippen merkt sie vor (beim
 * Bezahlen schräg, beim Bereitmachen aufgerichtet). Beim Bezahlen liegt links die Kasse.
 */

export interface PlanetRowProps {
  readonly game: GameState;
  readonly table: SheetTable;
}

/** Ausschnitt der Kachelbilder: Breite und Höhe der Vorlage in Pixeln. */
const TILE_W = 345;
const TILE_H = 299;

/** Bildausschnitt als Variablen; die Größe der Scheibe legt das Stylesheet fest. */
function artVars(look: PlanetLook): CSSProperties {
  const crop = PLANET_ART_CROPS[look];
  return {
    '--art': `url("${crop.path}")`,
    '--art-x': String(crop.x),
    '--art-y': String(crop.y),
    '--art-size': String(crop.size),
    '--tile-w': String(TILE_W),
    '--tile-h': String(TILE_H),
  } as CSSProperties;
}

/** Vorderseite: Planet im Ausschnitt, Ressourcen (Sechseck), Einfluss, Spezialität, Legende. */
function CardFace({ view }: { readonly view: PlanetCardView }): ReactElement {
  return (
    <span className="planet-face" aria-hidden="true">
      <span className="planet-art" style={artVars(view.look)} />
      <span className="planet-badge res">{view.resources}</span>
      <span className="planet-badge inf">{view.influence}</span>
      {view.specialty !== null && <span className={`planet-skip ${view.specialty}`} />}
      {view.legendary && <Star className="planet-legend" size={10} />}
    </span>
  );
}

const cardData = (view: PlanetCardView, turn: CardTurn) => ({
  'data-planet': view.id,
  'data-look': view.look,
  'data-exhausted': String(view.exhausted),
  'data-turn': String(turn),
  'data-home': view.home ? 'true' : undefined,
});

interface CardProps {
  readonly view: PlanetCardView;
  readonly label: string;
}

/** Eine Karte nur zur Ansicht (in Ruhe oder gerade nicht wählbar). */
function PlainCard({ view, label, mode }: CardProps & { readonly mode: RowMode }): ReactElement {
  return (
    <li
      className="planet-card"
      aria-label={label}
      title={label}
      {...cardData(view, cardTurn(view, mode, false))}
    >
      <CardFace view={view} />
    </li>
  );
}

interface ChoiceProps extends CardProps {
  readonly planets: PlanetTable;
  readonly state: TargetState | undefined;
}

/** Eine wählbare Karte; ihr Wert steht für Tests und Ansagen in `data-value`. */
function ChoiceCard({ view, label, planets, state }: ChoiceProps): ReactElement {
  const t = useT();
  const chosen = planets.chosen.includes(view.id);
  const value = planets.mode === 'pay' ? (planets.values.get(view.id) ?? 0) : 0;
  const marked = chosen && planets.mode === 'pay';
  return (
    <li className="planet-slot">
      <button
        type="button"
        role="checkbox"
        className="planet-card"
        aria-checked={chosen}
        aria-label={label}
        title={marked ? `${label} · ${t('planetMarked')}` : label}
        disabled={state === undefined}
        data-target={targetKey(planetTarget(view.id))}
        data-target-state={state}
        data-value={value}
        {...cardData(view, cardTurn(view, planets.mode, chosen))}
        onClick={() => planets.toggle(view.id)}
      >
        <CardFace view={view} />
      </button>
    </li>
  );
}

const NO_STATES: ReadonlyMap<string, TargetState> = new Map();

const offers = (planets: PlanetTable | null, view: PlanetCardView): planets is PlanetTable =>
  planets !== null && (planets.offered.includes(view.id) || planets.chosen.includes(view.id));

interface ListProps {
  readonly cards: readonly PlanetCardView[];
  readonly mode: RowMode;
  readonly planets: PlanetTable | null;
}

/** Die Karten; bei vielen rücken sie zusammen und die Reihe rollt in sich selbst. */
function CardList({ cards, mode, planets }: ListProps): ReactElement {
  const language = useLanguage();
  const states = planets === null ? NO_STATES : planetStates(planets);
  return (
    <ul className="planet-cards" style={{ '--count': cards.length } as CSSProperties}>
      {cards.map((view) => {
        const label = planetCardText(view, language);
        if (!offers(planets, view)) return <PlainCard key={view.id} {...{ view, label, mode }} />;
        const state = states.get(targetKey(planetTarget(view.id)));
        return <ChoiceCard key={view.id} {...{ view, label, planets, state }} />;
      })}
    </ul>
  );
}

interface RowProps extends ListProps {
  readonly table: SheetTable;
  /** Münzen auf der Handelsmatte; sie fehlen der Kasse. */
  readonly onMat: number;
}

/** Die angezeigte Reihe; solange sie steht, weiß das Bezahlformular davon. */
function Row({ cards, mode, planets, table, onMat }: RowProps): ReactElement {
  const t = useT();
  useRegisterPlanetRow();
  const kasse = planets !== null && kasseUseful(planets);
  return (
    <section
      className="planet-row"
      aria-label={t('planetRow')}
      data-mode={mode}
      data-tutorial="planet-row"
    >
      {kasse && <KassePlate table={table} planets={planets} onMat={onMat} />}
      <CardList cards={cards} mode={mode} planets={planets} />
    </section>
  );
}

export function PlanetRow({ game, table }: PlanetRowProps): ReactElement | null {
  const viewer = useViewer();
  const offered = usePlanetTable(game);
  const onMat = useOfferedGoods(game, viewer).tradeGoods;
  const cards = useMemo(
    () => (viewer === null ? [] : planetRow(game, viewer, content)),
    [game, viewer],
  );
  const planets = offered !== null && offered.player === viewer ? offered : null;
  if (cards.length === 0 && planets === null) return null;
  const mode = planets?.mode ?? 'rest';
  return <Row cards={cards} mode={mode} planets={planets} table={table} onMat={onMat} />;
}
