import * as Popover from '@radix-ui/react-popover';
import { type GameState, type PlayerId, systemId } from '@stellar/domain';
import { ChevronDown, ChevronUp } from 'lucide-react';
import {
  AnimatePresence,
  motion,
  type PanInfo,
  useIsPresent,
  useReducedMotion,
} from 'motion/react';
import { type CSSProperties, type ReactElement, type Ref, useRef, useState } from 'react';
import { useGameStore, useHumanActor, useViewer } from '../../game-store.ts';
import { lookOf } from '../../hand/card-look.ts';
import {
  entryKey,
  type HandEntry,
  handEntries,
  isTable,
  type TableEntry,
} from '../../hand/hand-model.ts';
import { useHandStore } from '../../hand/hand-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { playsByDrop } from '../../table/card-targets.ts';
import { useT } from '../../use-translation.ts';
import { PlayControls } from '../cards/CardItem.tsx';
import { hasTargets, initialTarget } from '../cards/TargetFields.tsx';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { HandFace, useEntryName } from './HandFaces.tsx';
import {
  cardAvailability,
  type CardMarks,
  type HandTable,
  useCardMarks,
  useHandTable,
} from './HandMarks.tsx';
import { type HandCarry, useHandCarry } from './use-hand-carry.ts';
import { officialLeader } from '@stellar/content';
import { OriginalLeaderCard } from '../exploration/OriginalLeaderCard.tsx';
import { leaderEffect } from '../../labels.ts';
import { useLanguage } from '../../use-translation.ts';

/** Fächer: Drehung je Karte, Absenkung zum Rand hin, Zugweg zum Ausspielen. */
const FAN_DEGREES = 4;
const FAN_DROP = 4;
const FLICK_PX = 90;
/** Bis zu so vielen Karten liegt die Hand locker; darüber rücken die Karten enger. */
const ROOMY = 5;
const LIFT = { y: -92, scale: 1.8, rotate: 0, zIndex: 40 } as const;
/** Angehoben zum Ausspielen (zweites Antippen): bleibt über dem Fächer stehen. */
const RAISED = { y: -64, scale: 1.3, rotate: 0, opacity: 1, zIndex: 38 } as const;
const SPRING = { type: 'spring', stiffness: 320, damping: 26 } as const;
/** Getragen: Die Karte bleibt blass im Fächer liegen, während ihr Geist auf dem Tisch ist. */
const CARRIED_OPACITY = 0.45;
/** Neue Karten kommen von unten herein, gespielte fliegen nach oben aufs Spielfeld. */
const DEALT = { y: 220, opacity: 0 } as const;
const PLAYED = { y: -260, opacity: 0, scale: 1.25 } as const;

/** Enge des Fächers und Kartenzahl fürs Stylesheet (die Tischansicht fasst die Hand in die Mulde). */
const dockStyle = (cards: number, seat: string | null): CSSProperties =>
  ({
    '--crowd': Math.max(0, cards - ROOMY),
    '--cards': cards,
    ...(seat === null ? {} : { '--seat': seat }),
  }) as CSSProperties;

/** Lage im Fächer: zur Mitte hin gerade und oben, nach außen gedreht und tiefer. */
const fanned = (offset: number) => ({
  y: offset * offset * FAN_DROP,
  rotate: offset * FAN_DEGREES,
  opacity: 1,
  scale: 1,
});

/**
 * Lage der Karte: angehoben, im Fächer oder getragen. Getragen hebt sie sich beim Zeigen nicht
 * an (der Zeiger bleibt während des Ziehens an ihr gefangen) und verblasst über motion selbst,
 * dessen Inline-Stil sonst jede Deckkraft aus dem Stylesheet überschreibt.
 */
const poseOf = (offset: number, lifted: boolean, carried: boolean) =>
  carried
    ? { animate: { ...fanned(offset), opacity: CARRIED_OPACITY } }
    : { animate: lifted ? RAISED : fanned(offset), whileHover: LIFT, whileFocus: LIFT };

const testIdOf = (entry: HandEntry): string | undefined => {
  if (entry.kind === 'action') return `card-${entry.card.definition.id}`;
  return isTable(entry) ? entryKey(entry) : undefined;
};

/** PoK-Karten vor dem Spieler: Relikt nutzen, Fragmente opfern, legendäre Fähigkeit. */
function tableCommand(entry: TableEntry) {
  const issuedBy = entry.player;
  if (entry.kind === 'relic') return { type: 'UseRelic', issuedBy, relic: entry.relic.id } as const;
  if (entry.kind === 'legendary')
    return { type: 'UseLegendaryAbility', issuedBy, planet: entry.planet } as const;
  if (entry.kind === 'leader')
    return { type: 'UseLeader', issuedBy, leader: entry.leader.id } as const;
  return entry.purge === null
    ? null
    : ({ type: 'PurgeRelicFragments', issuedBy, fragments: entry.purge } as const);
}

function turnCommand(entry: HandEntry, actor: PlayerId, selected: string | null) {
  if (entry.kind === 'pick')
    return { type: 'PickStrategyCard', issuedBy: actor, card: entry.card.id } as const;
  if (entry.kind === 'pass') return { type: 'Pass', issuedBy: actor } as const;
  if (entry.kind === 'tactical' && selected !== null)
    return { type: 'ActivateSystem', issuedBy: actor, system: systemId(selected) } as const;
  return null;
}

/** Der Befehl einer Karte; Aktionskarten spielt ihr Besitzer, alles andere der Spieler am Zug. */
function commandFor(entry: HandEntry, actor: PlayerId | null, selected: string | null) {
  if (isTable(entry)) return tableCommand(entry);
  if (entry.kind === 'action') {
    const { card, player } = entry;
    const target = initialTarget(card.targets);
    return { type: 'PlayActionCard', issuedBy: player, card: card.definition.id, target } as const;
  }
  return actor === null ? null : turnCommand(entry, actor, selected);
}

/** Ausspielen: Befehl senden; die strategische Aktion öffnet ihr Formular auf der Karte. */
function usePlay(game: GameState): (entry: HandEntry) => void {
  const send = useGameStore((state) => state.send);
  const actor = useHumanActor(game);
  const selected = useGameStore((state) => state.selected);
  return (entry) => {
    if (entry.kind === 'strategic' && actor !== null)
      useHandStore.getState().choose({ player: actor, card: entry.card.id });
    const command = commandFor(entry, actor, selected);
    if (command !== null) send(command);
  };
}

const needsTargets = (entry: HandEntry): boolean =>
  entry.kind === 'action' && hasTargets(entry.card.targets);

const classOf = (entry: HandEntry): string => {
  const extra = isTable(entry) ? ' table-card' : entry.kind === 'action' ? ' action-card' : '';
  return `hand-card${extra} ${entry.playable ? 'playable' : 'idle'}`;
};

interface CardProps {
  readonly game: GameState;
  readonly entry: HandEntry;
  readonly offset: number;
  readonly onPlay: () => void;
  readonly hand: HandTable;
  readonly inspect?: boolean;
  /** Karte mit Zielen am Tisch: Ziehen trägt sie auf ein Ziel statt sie hochzuwerfen. */
  readonly carry?: HandCarry | null;
  /** Der Knopf der Karte, an dem eine Zielwahl oder Vorschau hängt. */
  readonly cardRef?: Ref<HTMLButtonElement>;
}

/**
 * Antippen oder nach oben Ziehen; nach dem Ziehen zählt der Klick nicht doppelt. Eine Karte, die
 * sich auf den Tisch tragen lässt, wirft man nicht hoch: Ihr Ziehen gehört dem Tragen.
 */
function useGesture(
  active: boolean,
  marks: CardMarks,
  onDragChange: (dragging: boolean) => void,
  carry: HandCarry | null,
) {
  const dragged = useRef(false);
  const flick = active ? marks.flick : null;
  return {
    drag: flick !== null && carry === null ? ('y' as const) : false,
    dragSnapToOrigin: true,
    onDragStart: () => {
      dragged.current = true;
      onDragChange(true);
    },
    onDragEnd: (_: unknown, info: PanInfo) => {
      onDragChange(false);
      if (info.offset.y < -FLICK_PX) flick?.();
    },
    onClick: () => {
      const carried = carry?.swallowClick() ?? false;
      const swallowed = dragged.current || carried;
      dragged.current = false;
      if (!swallowed && active) marks.tap();
    },
  };
}

/** Die Zeigergesten des Tragens ohne die Angaben, die nur der Hook selbst braucht. */
function carryHandlers(carry: HandCarry | null, title: string) {
  if (carry === null) return {};
  const { onPointerDown, onPointerMove, onPointerUp, onPointerCancel } = carry;
  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, title };
}

/** A used component stays on the mat, turned sideways until the game readies it again. */
const exhausted = (entry: HandEntry): boolean => {
  if (entry.kind === 'leader') return entry.leader.status === 'exhausted';
  if (entry.kind === 'relic') return entry.relic.exhausted;
  return entry.kind === 'legendary' && entry.used;
};

function useCardMotion(enabled: boolean) {
  const reduced = useReducedMotion();
  const [dragging, setDragging] = useState(false);
  return { dragging, setDragging, transition: enabled && !reduced ? SPRING : { duration: 0 } };
}

function useCardIdentity(entry: HandEntry, inspect: boolean, present: boolean, disabled: boolean) {
  const t = useT();
  const name = useEntryName();
  return {
    type: 'button' as const,
    className: classOf(entry),
    'data-kind': entry.kind,
    'data-look': lookOf(entry),
    'data-testid': testIdOf(entry),
    'data-leaving': present ? undefined : true,
    'data-exhausted': exhausted(entry),
    'aria-label': name(entry),
    'aria-disabled': disabled,
    title: inspect ? name(entry) : t(entry.playable ? 'playGesture' : 'notPlayableNow'),
  };
}

function HandCard(props: CardProps): ReactElement {
  const { game, entry, offset, hand, inspect = false, carry = null } = props;
  const t = useT();
  const cardMotion = useCardMotion(useSettingsStore((state) => state.animations));
  const present = useIsPresent();
  const marks = useCardMarks(entry, hand, props.onPlay);
  const availability = cardAvailability(entry, marks, inspect, present);
  const identity = useCardIdentity(entry, inspect, present, availability.disabled);
  const gesture = useGesture(availability.active, marks, cardMotion.setDragging, carry);
  const carried = carry?.carried === true;
  return (
    <motion.button
      ref={props.cardRef}
      {...identity}
      {...carryHandlers(carry, t('tableHintCardTarget'))}
      {...marks.attributes}
      data-dragging={cardMotion.dragging}
      data-carried={carried ? 'true' : undefined}
      initial={DEALT}
      {...poseOf(offset, marks.lifted, carried)}
      exit={PLAYED}
      whileDrag={{ scale: 1.12, rotate: 0, zIndex: 55 }}
      transition={cardMotion.transition}
      {...gesture}
    >
      <HandFace game={game} entry={entry} />
      {marks.children}
    </motion.button>
  );
}

function LeaderCardContent({ entry, onPlay }: CardProps) {
  const language = useLanguage();
  if (entry.kind !== 'leader') return null;
  const de = language === 'de';
  return (
    <>
      <OriginalLeaderCard id={entry.leader.id} expanded />
      <p>
        {de ? 'Webapp (vereinfacht): ' : 'Web app (simplified): '}
        {leaderEffect(entry.leader.id, language)}
      </p>
      <button type="button" className="hex-button" disabled={!entry.playable} onClick={onPlay}>
        {de ? 'Vereinfachte Aktion ausführen' : 'Use simplified action'}
      </button>
      <Popover.Close className="hex-button">{de ? 'Schließen' : 'Close'}</Popover.Close>
    </>
  );
}

/**
 * Eine Vorschau oder Zielwahl hängt an der Karte selbst: Radix misst den Knopf, nicht eine Hülle
 * ohne eigenen Kasten (die läge für das Messen in der linken oberen Ecke).
 */
function useCardAnchor() {
  const card = useRef<HTMLButtonElement>(null);
  const anchor = useRef({
    getBoundingClientRect: () => card.current?.getBoundingClientRect() ?? new DOMRect(),
  });
  return { card, anchor };
}

/** Inspect the actual leader before choosing the separately labelled adapted action. */
function LeaderCard(props: CardProps): ReactElement {
  const [open, setOpen] = useState(false);
  const { card, anchor } = useCardAnchor();
  const { entry } = props;
  if (entry.kind !== 'leader') return <HandCard {...props} />;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor virtualRef={anchor} />
      <HandCard {...props} cardRef={card} inspect onPlay={() => setOpen(true)} />
      <Popover.Portal>
        <Popover.Content
          className="ui-popover glass leader-card-preview"
          side="top"
          sideOffset={12}
        >
          <LeaderCardContent
            {...props}
            onPlay={() => {
              props.onPlay();
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DockCard(props: CardProps): ReactElement {
  const { entry } = props;
  if (needsTargets(entry)) return <TargetedCard {...props} />;
  if (entry.kind === 'leader' && officialLeader(entry.leader.id) !== undefined)
    return <LeaderCard {...props} />;
  return <HandCard {...props} />;
}

/**
 * Am Tisch lässt sich eine spielbare Karte tragen, solange die Hand ausspielt und ein einziges
 * Ablegen sie ganz ausspielt (nicht Karten für mehrere Planeten).
 */
const carries = (hand: HandTable, entry: HandEntry): boolean =>
  hand.carry &&
  hand.mode !== 'discard' &&
  entry.playable &&
  entry.kind === 'action' &&
  playsByDrop(entry.card.targets);

/**
 * Aktionskarte mit Zielen: Antippen öffnet die Zielwahl direkt über der Karte; am Tisch lässt
 * sie sich auch auf ein leuchtendes Ziel ziehen.
 */
function TargetedCard(props: Omit<CardProps, 'onPlay'>): ReactElement {
  const [open, setOpen] = useState(false);
  const { card: button, anchor } = useCardAnchor();
  const { game, entry, hand } = props;
  const card = entry.kind === 'action' ? entry.card : null;
  const carry = useHandCarry(card, hand.router, carries(hand, entry));
  if (entry.kind !== 'action') return <HandCard {...props} onPlay={() => undefined} />;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor virtualRef={anchor} />
      <HandCard {...props} cardRef={button} carry={carry} onPlay={() => setOpen(true)} />
      <Popover.Portal>
        <Popover.Content className="ui-popover glass hand-targets" side="top" sideOffset={12}>
          <PlayControls game={game} player={entry.player} card={entry.card} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

/** Die eigene Hand; spielbar ist, was der eigene Platz gerade darf. */
function useEntries(game: GameState): readonly HandEntry[] {
  const actor = useHumanActor(game);
  const viewer: PlayerId | null = useViewer();
  const selected = useGameStore((state) => state.selected);
  const chosen = useHandStore((state) => state.chosen);
  const choosing = chosen !== null && chosen.player === actor;
  return handEntries({ game, actor, viewer, selected, choosing });
}

/** Ob eine spielbare Karte dieser Art auf der Hand liegt. */
const anyPlayable = (entries: readonly HandEntry[], kind: HandEntry['kind']): boolean =>
  entries.some((entry) => entry.kind === kind && entry.playable);

/**
 * Wird gerade nur über die Hand entschieden, liegt sie offen, sonst eingeklappt: Strategiekarten
 * wählen, Karten über dem Limit ablegen, im Reaktionsfenster eine spielbare Karte.
 */
function neededNow(game: GameState, entries: readonly HandEntry[], hand: HandTable): boolean {
  if (hand.mode === 'discard') return true;
  if (hand.mode === 'reaction') return anyPlayable(entries, 'action');
  return game.phase === 'strategy' && anyPlayable(entries, 'pick');
}

/** Klappt die Hand aus oder ein; solange sie gebraucht wird, liegt sie ohnehin offen. */
function HandToggle(): ReactElement {
  const t = useT();
  const handOpen = useSettingsStore((state) => state.handOpen);
  const setHandOpen = useSettingsStore((state) => state.setHandOpen);
  const Icon = handOpen ? ChevronDown : ChevronUp;
  return (
    <button
      type="button"
      className="hand-toggle"
      aria-expanded={handOpen}
      aria-label={t(handOpen ? 'handCollapse' : 'handExpand')}
      onClick={() => setHandOpen(!handOpen)}
    >
      <Icon size={14} aria-hidden="true" />
    </button>
  );
}

/** Über den Karten: wessen Hand, dazu der Knopf zum Aus- und Einklappen. */
function HandOwner(props: { readonly game: GameState; readonly needed: boolean }) {
  const t = useT();
  const owner = useViewer();
  if (owner === null) return null;
  return (
    <p className="hand-owner">
      {t('handOf')} <PlayerTag game={props.game} id={owner} />
      {!props.needed && <HandToggle />}
    </p>
  );
}

/**
 * Die Hand am unteren Rand der Karte: Strategiekarten in der Strategiephase, im Zug die
 * strategische und taktische Aktion und Passen, dazu die Aktionskarten. Eingeklappt ragen nur
 * die Kartenköpfe herein, damit das eigene Heimatsystem frei bleibt; Zeigen hebt sie an.
 */
export function HandDock({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const entries = useEntries(game);
  const play = usePlay(game);
  const hand = useHandTable(game);
  const handOpen = useSettingsStore((state) => state.handOpen);
  const needed = neededNow(game, entries, hand);
  const raised = handOpen || needed;
  const middle = (entries.length - 1) / 2;
  return (
    <section
      className={raised ? 'hand-dock raised' : 'hand-dock tucked'}
      aria-label={t('yourHand')}
      data-tutorial="hand"
      style={dockStyle(entries.length, hand.seat)}
    >
      {entries.length > 0 && <HandOwner game={game} needed={needed} />}
      <AnimatePresence initial={false}>
        {entries.map((entry, index) => {
          const props = { game, entry, hand, offset: index - middle };
          return <DockCard key={entryKey(entry)} {...props} onPlay={() => play(entry)} />;
        })}
      </AnimatePresence>
    </section>
  );
}
