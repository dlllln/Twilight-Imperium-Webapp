import type { GameState, TechnologyColor } from '@stellar/domain';
import { type CSSProperties, type ReactElement, useEffect, useRef } from 'react';
import { planetLabel } from '../../labels.ts';
import {
  type ResearchCard,
  type ResearchColumn,
  type ResearchSpread as Spread,
  researchSpreadOf,
  type SpreadSpecialty,
} from '../../table/spec-research.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { cardText } from '../game/card-text.ts';
import { useMatFloor } from './use-mat-floor.ts';
import { ResearchCardFace } from '../technology/TechnologyForm.tsx';
import '../cards/card-table.css';
import './research-spread.css';

/*
 * Die Forschungsauslage: ein offener Kartentisch in der Mitte, auf dem die noch nicht
 * erforschten Technologien in Spalten je Farbe liegen. Antippen wählt eine Karte, gesperrte
 * nennen ihre fehlenden Farben. Planeten mit Spezialisierung liegen als Schalter darüber. Die
 * Auslage ist kein Dialog: Planetenreihe, Kasse und Ansage bleiben daneben bedienbar. Gesperrte
 * Karten liegen am Ende jeder Spalte als schmale Streifen (Name und fehlende Farben).
 */

type Translate = ReturnType<typeof useT>;

const colorsText = (t: Translate, colors: readonly TechnologyColor[]): string =>
  colors.map((color) => t(color)).join(', ');

/**
 * Der Zustand einer Karte in Worten; gesperrte nennen die fehlenden Farben, gewählte auch, wenn
 * ihnen eine Voraussetzung abhandengekommen ist (etwa weil eine andere Karte zurückging).
 */
function stateText(t: Translate, card: ResearchCard): string | null {
  const missing = `${t('researchLocked')}: ${colorsText(t, card.missing)}`;
  if (card.state === 'chosen')
    return card.missing.length > 0 ? `${t('researchChosen')} – ${missing}` : t('researchChosen');
  if (card.state === 'full') return t('researchFull');
  return card.state === 'open' ? null : missing;
}

interface CardProps {
  readonly card: ResearchCard;
  readonly index: number;
  readonly decision: TableDecision;
}

/** Eine Karte der Auslage: ein echtes Kästchen über der ganzen Karte, darunter ihr Gesicht. */
function SpreadCard({ card, index, decision }: CardProps): ReactElement {
  const t = useT();
  const { technology, missing, state } = card;
  const note = stateText(t, card);
  const locked = state === 'locked' ? ' locked' : '';
  return (
    <label
      className={`tech-option research-card ti4-print-card${locked}`}
      data-tech={technology.id}
      data-state={state}
      data-unmet={state === 'chosen' && missing.length > 0 ? 'true' : undefined}
      style={{ '--i': index } as CSSProperties}
    >
      <input
        type="checkbox"
        className="research-card-input"
        checked={state === 'chosen'}
        disabled={state === 'locked' || state === 'full'}
        onChange={() => decision.act({ kind: 'technology', technology: technology.id })}
      />
      <ResearchCardFace technology={technology} missing={missing} />
      {note !== null && <span className="research-card-state">{note}</span>}
    </label>
  );
}

const colorClass = (color: TechnologyColor | null): string => `tech-${color ?? 'upgrade'}`;

/** Eine Spalte je Farbe, die Aufwertungen für Einheiten zuletzt. */
function SpreadColumn(props: {
  readonly column: ResearchColumn;
  readonly decision: TableDecision;
}) {
  const t = useT();
  const { color, cards } = props.column;
  return (
    <fieldset className={`research-column ${colorClass(color)}`}>
      <legend>{color === null ? t('unitUpgrades') : t(color)}</legend>
      {cards.map((card, index) => (
        <SpreadCard key={card.technology.id} card={card} index={index} decision={props.decision} />
      ))}
    </fieldset>
  );
}

/** Ein Planet mit Spezialisierung als Schalter: genutzt ersetzt er eine fehlende Farbe. */
function SpecialtySkip(props: {
  readonly skip: SpreadSpecialty;
  readonly decision: TableDecision;
}) {
  const t = useT();
  const language = useLanguage();
  const { planet, color, chosen } = props.skip;
  const name = planetLabel(planet, language);
  const label = t('specialtySkip').replace('{planet}', `${name} (${t(color)})`);
  return (
    <label className={`specialty-skip ${colorClass(color)}`} data-chosen={chosen}>
      <input
        type="checkbox"
        aria-label={label}
        checked={chosen}
        onChange={() => props.decision.act({ kind: 'specialty', planet })}
      />
      <span className="specialty-skip-name">{name}</span>
      <span className={`tech-dot ${colorClass(color)}`} title={t(color)} />
    </label>
  );
}

function SpecialtySkips(props: { readonly spread: Spread; readonly decision: TableDecision }) {
  const t = useT();
  if (props.spread.specialties.length === 0) return null;
  return (
    <fieldset className="research-skips">
      <legend>{t('specialties')}</legend>
      {props.spread.specialties.map((skip) => (
        <SpecialtySkip key={skip.planet} skip={skip} decision={props.decision} />
      ))}
    </fieldset>
  );
}

/** Kopf wie am Kartentisch: Karte und Zählung, Titel, Hinweis. */
function SpreadHeader(props: { readonly spread: Spread; readonly decision: TableDecision }) {
  const t = useT();
  const language = useLanguage();
  const card = props.decision.route.card;
  const { count, max } = props.spread;
  return (
    <header className="card-table-header research-spread-header">
      <div className="card-table-kicker">
        {card !== null && <span>{cardText(card).name[language]}</span>}
        <span className="research-spread-count">
          {t('researchChosen')}: {count} / {max}
        </span>
      </div>
      <h2>{t('researchSpread')}</h2>
      <p>{t('tableHintResearch')}</p>
    </header>
  );
}

/** Telefone: Dort liegt die Auslage über Spielerleiste und Auftragsleiste (research-spread.css). */
const COVERING = '(max-width: 760px)';
const COVERED = ['.hud-players', '.objective-strip'];

/** Setzt die verdeckten Leisten außer Reichweite (`inert`), solange die Auslage sie verdeckt. */
function coverStrips(covering: boolean): void {
  for (const element of document.querySelectorAll(COVERED.join(','))) {
    if (covering) element.setAttribute('inert', '');
    else element.removeAttribute('inert');
  }
}

/**
 * Solange die Auslage offen ist und die Leisten verdeckt, erreicht der Tab keinen Knopf darunter
 * (kein Fokus hinter der Auslage); danach sind beide wieder bedienbar.
 */
function useCoveredStrips(open: boolean): void {
  useEffect(() => {
    if (!open || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(COVERING);
    const update = () => coverStrips(query.matches);
    update();
    query.addEventListener('change', update);
    return () => {
      query.removeEventListener('change', update);
      coverStrips(false);
    };
  }, [open]);
}

/** Die Auslage der offenen Technologie-Entscheidung; sonst liegt nichts auf dem Tisch. */
export function ResearchSpread({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const decision = useTableDecision(game);
  const spread = researchSpreadOf(game, decision);
  const ref = useRef<HTMLElement>(null);
  const open = decision !== null && spread !== null;
  useCoveredStrips(open);
  useMatFloor(ref, open);
  if (decision === null || spread === null) return null;
  const columns = spread.columns.filter((column) => column.cards.length > 0);
  return (
    <section
      ref={ref}
      className="research-spread"
      data-tutorial="research-spread"
      role="region"
      aria-label={t('researchSpread')}
      data-testid="research-spread"
      data-ability={decision.route.ability ?? 'primary'}
    >
      <SpreadHeader spread={spread} decision={decision} />
      <SpecialtySkips spread={spread} decision={decision} />
      <div className="research-columns">
        {columns.map((column) => (
          <SpreadColumn key={column.color ?? 'upgrade'} column={column} decision={decision} />
        ))}
      </div>
    </section>
  );
}
