import { type GameState, NO_PAYMENT, type ObjectiveId } from '@stellar/domain';
import { ChevronDown, Target } from 'lucide-react';
import { type CSSProperties, type ReactElement, useEffect, useId, useMemo, useState } from 'react';
import { objectiveArtwork, objectiveFrame } from '../../artwork/cards.ts';
import { useGameStore, useViewer } from '../../game-store.ts';
import { objectiveStrip, scorableNow, type StripCard } from '../../hud/objective-strip.ts';
import { objectiveLabel } from '../../labels.ts';
import { seatColor } from '../../seat-colors.ts';
import { content } from '../../store.ts';
import { cardTarget, targetKey, type TargetState } from '../../table/target-ref.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { CompleteCardArtwork } from '../cards/CompleteCardArtwork.tsx';
import './objective-strip.css';

/*
 * Die Auftragsleiste auf dem Tisch, oben in der Mitte zwischen Spielerleiste und Vorrat:
 * öffentliche Aufträge und die eigenen geheimen als kleine Karten. Steht eine Wertung an, werden
 * die wählbaren Karten zu Knöpfen; in der Aktionsphase lassen sich erfüllte geheime Aufträge
 * ohne Bezahlung direkt werten. Gewertete Karten tragen Scheiben in den Farben der Spieler.
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

/** Offen auf breiten Schirmen und bei einer Entscheidung; ein Druck auf den Schalter gilt je Modus. */
function useExpanded(mode: Mode) {
  const wide = useWide();
  const [override, setOverride] = useState<{ readonly mode: Mode; readonly open: boolean } | null>(
    null,
  );
  const expanded = override?.mode === mode ? override.open : wide || mode === 'decision';
  return { expanded, toggle: () => setOverride({ mode, open: !expanded }) };
}

/** Nur die Karten-Ziele der Entscheidung; Planeten bedienen Pult und Karte. */
function cardTargets(decision: TableDecision | null): ReadonlyMap<string, TargetState> {
  const entries = [...(decision?.targets ?? new Map<string, TargetState>())];
  return new Map(entries.filter(([key]) => key.startsWith('card:')));
}

function useCardName(): (card: StripCard) => string {
  const t = useT();
  const language = useLanguage();
  return (card) => {
    if (card.id !== null) return objectiveLabel(card.id, language);
    return t(card.stage === 2 ? 'stageTwo' : 'stageOne');
  };
}

/** Vorderseite (eigener Druck) oder bei verdeckten Aufträgen die Rückseite ihrer Stufe. */
function StripFace({ card }: { readonly card: StripCard }): ReactElement {
  const artwork =
    card.id === null
      ? objectiveArtwork('public', card.stage)
      : objectiveFrame(card.id, card.category, card.stage);
  return (
    <span className="objective-strip-face">
      <CompleteCardArtwork artwork={artwork} />
    </span>
  );
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
  const names = seats.map((seat) => game.players.find((p) => p.seat === seat)?.name ?? '');
  return (
    <span
      className="objective-strip-discs"
      role="img"
      aria-label={`${t('scoredByLabel')}: ${names.join(', ')}`}
    >
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
}

/** Bild, Name und Punkte; die Schrift ist echtes HTML über dem Druck. */
function CardBody({ game, card, name }: CardProps): ReactElement {
  return (
    <>
      <StripFace card={card} />
      <span className="objective-strip-name">{name}</span>
      {card.revealed && <span className="objective-strip-points">{card.points}</span>}
      <ScorerDiscs game={game} seats={card.scorerSeats} />
    </>
  );
}

interface PickProps extends CardProps {
  readonly id: ObjectiveId;
  readonly state: TargetState;
  readonly onPick: (id: ObjectiveId) => void;
}

/** Eine wählbare Karte der Entscheidung: ein Knopf mit Zielzustand. */
function PickCard({ id, state, onPick, ...props }: PickProps): ReactElement {
  return (
    <button
      type="button"
      className="objective-strip-card"
      data-target={targetKey(cardTarget(id))}
      data-target-state={state}
      aria-pressed={state === 'chosen'}
      aria-label={`${props.name} (${String(props.card.points)})`}
      onClick={() => onPick(id)}
    >
      <CardBody {...props} />
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
}

function StripItem({ state, scorable, onPick, ...props }: ItemProps): ReactElement {
  const { card } = props;
  const pickable = card.id !== null && state !== undefined;
  return (
    <li
      className="objective-strip-item"
      data-category={card.category}
      data-revealed={card.revealed}
      data-scored={card.scorerSeats.length > 0}
      data-pickable={pickable}
    >
      {card.id !== null && state !== undefined ? (
        <PickCard {...props} id={card.id} state={state} onPick={onPick} />
      ) : (
        <span className="objective-strip-card">
          <CardBody {...props} />
        </span>
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
  const targets = cardTargets(decision);
  const { cards, scorable } = useStripCards(game);
  const pick = (objective: ObjectiveId) => decision?.act({ kind: 'objective', objective });
  return (
    <ol id={id} className="objective-strip-cards">
      {cards.map((card, index) => (
        <StripItem
          key={card.id ?? `hidden-${String(index)}`}
          game={game}
          card={card}
          name={nameOf(card)}
          state={card.id === null ? undefined : targets.get(targetKey(cardTarget(card.id)))}
          scorable={card.id !== null && scorable.has(card.id)}
          onPick={pick}
        />
      ))}
    </ol>
  );
}

/** Die Auftragsleiste der Tischansicht. */
export function ObjectiveStrip({ game }: ObjectiveStripProps): ReactElement {
  const t = useT();
  const id = useId();
  const decision = useTableDecision(game);
  const mode: Mode = cardTargets(decision).size > 0 ? 'decision' : 'rest';
  const { expanded, toggle } = useExpanded(mode);
  return (
    <section
      className="objective-strip"
      aria-label={t('objectiveStrip')}
      data-mode={mode}
      data-expanded={expanded}
    >
      <StripToggle expanded={expanded} list={id} toggle={toggle} />
      <StripCards game={game} decision={decision} id={id} />
    </section>
  );
}
