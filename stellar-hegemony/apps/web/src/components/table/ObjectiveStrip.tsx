import { type GameState, NO_PAYMENT, type ObjectiveId } from '@stellar/domain';
import { ChevronDown, Target } from 'lucide-react';
import { type CSSProperties, type ReactElement, useEffect, useId, useMemo, useState } from 'react';
import { useGameStore, useViewer } from '../../game-store.ts';
import { objectiveStrip, scorableNow, type StripCard } from '../../hud/objective-strip.ts';
import { objectiveLabel, objectiveRequirement } from '../../labels.ts';
import { seatColor } from '../../seat-colors.ts';
import { content } from '../../store.ts';
import { cardTarget, targetKey, type TargetState } from '../../table/target-ref.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { StripFace, StripZoom, useZoom, type ZoomHandlers } from './StripZoom.tsx';
import { VictoryTrack } from './VictoryTrack.tsx';
import './objective-strip.css';

/*
 * Die Auftragsleiste auf dem Tisch, oben in der Mitte zwischen Spielerleiste und Vorrat:
 * öffentliche Aufträge und die eigenen geheimen als kleine Karten. Steht eine Wertung an, werden
 * die wählbaren Karten zu Knöpfen; in der Aktionsphase lassen sich erfüllte geheime Aufträge
 * ohne Bezahlung direkt werten. Gewertete Karten tragen Scheiben in den Farben der Spieler.
 * Darunter liegt die Siegpunktleiste; sie bleibt auch bei eingeklappter Leiste sichtbar.
 */

export interface ObjectiveStripProps {
  readonly game: GameState;
}

type Mode = 'rest' | 'decision';

/** Dieselbe Grenze wie beim Vorrat: breit oder quer liegt die Leiste offen. */
const WIDE = '(min-width: 1101px), (min-width: 761px) and (orientation: landscape)';

function useWide(): boolean {
  const media = useMemo(
    () => (typeof window.matchMedia === 'function' ? window.matchMedia(WIDE) : null),
    [],
  );
  const [wide, setWide] = useState(media?.matches ?? true);
  useEffect(() => {
    if (media === null) return;
    const change = () => setWide(media.matches);
    media.addEventListener('change', change);
    return () => media.removeEventListener('change', change);
  }, [media]);
  return wide;
}

interface Override {
  readonly scope: string;
  readonly open: boolean;
}

/**
 * Offen auf breiten Schirmen und bei einer Entscheidung. Ein Druck auf den Schalter gilt nur in
 * seinem Rahmen: Modus und Breite, bei einer Entscheidung auch nur für diese eine.
 */
function useExpanded(mode: Mode, decision: string | null) {
  const wide = useWide();
  const [override, setOverride] = useState<Override | null>(null);
  const scope =
    mode === 'decision' ? `decision:${String(wide)}:${decision ?? ''}` : `rest:${String(wide)}`;
  const expanded = override?.scope === scope ? override.open : wide || mode === 'decision';
  return { expanded, toggle: () => setOverride({ scope, open: !expanded }) };
}

/** Nur die Karten-Ziele der Entscheidung; Planeten bedienen Pult und Karte. */
function cardTargets(decision: TableDecision | null): ReadonlyMap<string, TargetState> {
  const entries = [...(decision?.targets ?? new Map<string, TargetState>())];
  return new Map(entries.filter(([key]) => key.startsWith('card:')));
}

type Translate = ReturnType<typeof useT>;

/** „1 Siegpunkt“ bzw. „3 Siegpunkte“. */
const pointsText = (t: Translate, points: number): string =>
  points === 1 ? t('pointsOne') : t('pointsMany').replace('{count}', String(points));

/** Was die Karte verlangt und bringt; verdeckte Karten verraten nichts. */
function useCardText(): (card: StripCard) => string {
  const t = useT();
  const language = useLanguage();
  return (card) => {
    if (card.id === null || !card.revealed) return '';
    return `${pointsText(t, card.points)}. ${objectiveRequirement(card.id, language)}`;
  };
}

function useCardName(): (card: StripCard) => string {
  const t = useT();
  const language = useLanguage();
  return (card) => {
    if (card.id !== null) return objectiveLabel(card.id, language);
    return t(card.stage === 2 ? 'stageTwo' : 'stageOne');
  };
}

/** „Gewertet von: …“; ohne Wertung leer. */
function scorersText(game: GameState, seats: readonly number[], t: Translate): string {
  if (seats.length === 0) return '';
  const names = seats.map((seat) => game.players.find((p) => p.seat === seat)?.name ?? '');
  return `${t('scoredByLabel')}: ${names.join(', ')}`;
}

/** Kontrollscheiben der Spieler, die den Auftrag gewertet haben. */
function ScorerDiscs({
  game,
  seats,
}: {
  readonly game: GameState;
  readonly seats: readonly number[];
}) {
  const t = useT();
  if (seats.length === 0) return null;
  return (
    <span className="objective-strip-discs" role="img" aria-label={scorersText(game, seats, t)}>
      {seats.map((seat) => (
        <i
          key={seat}
          className="objective-strip-disc"
          data-seat={seat + 1}
          style={{ '--seat': seatColor(seat + 1) } as CSSProperties}
        />
      ))}
    </span>
  );
}

interface CardProps {
  readonly game: GameState;
  readonly card: StripCard;
  readonly name: string;
  /** Punkte und Bedingung in Worten; bei verdeckten Karten leer. */
  readonly text: string;
}

/** Bild, Name und Punkte; die Schrift ist echtes HTML über dem Druck. */
function CardBody({ game, card, name }: CardProps): ReactElement {
  const t = useT();
  return (
    <>
      <StripFace card={card} />
      <span className="objective-strip-name">{name}</span>
      {card.revealed && <span className="objective-strip-points">{card.points}</span>}
      <ScorerDiscs game={game} seats={card.scorerSeats} />
      <span className="objective-strip-tab" aria-hidden="true">
        {t('chosenTab')}
      </span>
    </>
  );
}

/** Name und Bedingung als Tooltip, z. B. „Kriegskasse: 1 Siegpunkt. Gib 8 Ressourcen aus.“ */
const tooltipOf = (name: string, text: string): string => (text === '' ? name : `${name}: ${text}`);

/** Eine Karte nur zur Ansicht; Bildschirmleser hören Bedingung und Punkte mit. */
function PlainCard(props: CardProps): ReactElement {
  return (
    <span className="objective-strip-card" title={tooltipOf(props.name, props.text)}>
      <CardBody {...props} />
      {props.text !== '' && <span className="sr-only">{props.text}</span>}
    </span>
  );
}

interface PickProps extends CardProps {
  readonly id: ObjectiveId;
  readonly state: TargetState;
  readonly onPick: (id: ObjectiveId) => void;
}

/**
 * Eine wählbare Karte der Entscheidung: ein Knopf mit Zielzustand. Der Name ist sein Name;
 * Punkte, Bedingung und wer schon gewertet hat, beschreiben ihn.
 */
function PickCard({ id, state, onPick, ...props }: PickProps): ReactElement {
  const t = useT();
  const describedBy = useId();
  const scorers = scorersText(props.game, props.card.scorerSeats, t);
  const description = [props.text, scorers].filter((part) => part !== '').join('. ');
  return (
    <button
      type="button"
      className="objective-strip-card"
      data-target={targetKey(cardTarget(id))}
      data-target-state={state}
      aria-pressed={state === 'chosen'}
      aria-label={props.name}
      aria-describedby={describedBy}
      title={tooltipOf(props.name, props.text)}
      onClick={() => onPick(id)}
    >
      <CardBody {...props} />
      <span id={describedBy} hidden>
        {description}
      </span>
    </button>
  );
}

/** Werten in der Aktionsphase: ein eigener Knopf unter der Karte, ohne Bezahlung. */
function ScoreNow({ id, name }: { readonly id: ObjectiveId; readonly name: string }) {
  const t = useT();
  const me = useViewer();
  const send = useGameStore((state) => state.send);
  if (me === null) return null;
  const score = () =>
    send({ type: 'ScoreObjective', issuedBy: me, objective: id, payment: NO_PAYMENT });
  return (
    <button
      type="button"
      className="objective-strip-score"
      aria-label={t('scoreNow').replace('{objective}', name)}
      onClick={score}
    >
      {t('score')}
    </button>
  );
}

interface ItemProps extends CardProps {
  readonly state: TargetState | undefined;
  readonly scorable: boolean;
  readonly onPick: (id: ObjectiveId) => void;
  readonly zoom: ZoomHandlers;
}

function StripItem({ state, scorable, onPick, zoom, ...props }: ItemProps): ReactElement {
  const { card } = props;
  const pickable = card.id !== null && state !== undefined;
  return (
    <li
      className="objective-strip-item"
      data-category={card.category}
      data-revealed={card.revealed}
      data-scored={card.scorerSeats.length > 0}
      data-pickable={pickable}
      {...zoom}
    >
      {card.id !== null && state !== undefined ? (
        <PickCard {...props} id={card.id} state={state} onPick={onPick} />
      ) : (
        <PlainCard {...props} />
      )}
      {card.id !== null && scorable && <ScoreNow id={card.id} name={props.name} />}
    </li>
  );
}

function StripToggle(props: {
  readonly expanded: boolean;
  readonly list: string;
  readonly toggle: () => void;
}) {
  const t = useT();
  return (
    <button
      type="button"
      className="objective-strip-toggle"
      aria-expanded={props.expanded}
      aria-controls={props.list}
      onClick={props.toggle}
    >
      <Target size={13} aria-hidden="true" />
      <span>{t('objectiveStripToggle')}</span>
      <ChevronDown size={12} aria-hidden="true" />
    </button>
  );
}

interface CardsProps {
  readonly game: GameState;
  readonly decision: TableDecision | null;
  readonly id: string;
}

/** Karten der Leiste und was davon sofort wertbar ist; beides nur bei neuem Spielstand neu. */
function useStripCards(game: GameState) {
  const me = useViewer();
  const cards = useMemo(() => objectiveStrip(game, me, content), [game, me]);
  const scorable = useMemo(() => scorableNow(game, me, content), [game, me]);
  return { cards, scorable };
}

/** Die Karten in ihrer Reihenfolge; wählbare und sofort wertbare tragen ihre Knöpfe. */
function StripCards({ game, decision, id }: CardsProps): ReactElement {
  const nameOf = useCardName();
  const textOf = useCardText();
  const targets = cardTargets(decision);
  const { cards, scorable } = useStripCards(game);
  const { zoom, handlers } = useZoom();
  const zoomed = zoom === null ? undefined : cards[zoom.index];
  const pick = (objective: ObjectiveId) => decision?.act({ kind: 'objective', objective });
  return (
    <>
      <ol id={id} className="objective-strip-cards">
        {cards.map((card, index) => (
          <StripItem
            key={card.id ?? `hidden-${String(index)}`}
            {...{ game, card, name: nameOf(card), text: textOf(card), onPick: pick }}
            state={card.id === null ? undefined : targets.get(targetKey(cardTarget(card.id)))}
            scorable={card.id !== null && scorable.has(card.id)}
            zoom={handlers(index)}
          />
        ))}
      </ol>
      {zoom !== null && zoomed !== undefined && (
        <StripZoom card={zoomed} name={nameOf(zoomed)} text={textOf(zoomed)} x={zoom.x} />
      )}
    </>
  );
}

/** Die Sitzfarbe des Betrachters: Mit ihr leuchtet die gewählte Karte. */
function useSeatStyle(game: GameState): CSSProperties | undefined {
  const me = useViewer();
  const seat = game.players.find((player) => player.id === me)?.seat;
  return seat === undefined ? undefined : ({ '--seat': seatColor(seat + 1) } as CSSProperties);
}

/** Die Auftragsleiste der Tischansicht. */
export function ObjectiveStrip({ game }: ObjectiveStripProps): ReactElement {
  const t = useT();
  const id = useId();
  const decision = useTableDecision(game);
  const mode: Mode = cardTargets(decision).size > 0 ? 'decision' : 'rest';
  const { expanded, toggle } = useExpanded(mode, decision?.route.key ?? null);
  return (
    <section
      className="objective-strip"
      data-tutorial="objective-strip"
      aria-label={t('objectiveStrip')}
      data-mode={mode}
      data-expanded={expanded}
      style={useSeatStyle(game)}
    >
      <StripToggle expanded={expanded} list={id} toggle={toggle} />
      <StripCards game={game} decision={decision} id={id} />
      <VictoryTrack game={game} />
    </section>
  );
}
