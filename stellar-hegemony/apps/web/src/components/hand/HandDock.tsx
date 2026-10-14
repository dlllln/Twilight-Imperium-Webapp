import * as Popover from '@radix-ui/react-popover';
import { type GameState, type PlayerId, systemId } from '@stellar/domain';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion, type PanInfo, useIsPresent } from 'motion/react';
import { type CSSProperties, type ReactElement, useRef, useState } from 'react';
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
import { useT } from '../../use-translation.ts';
import { PlayControls } from '../cards/CardItem.tsx';
import { hasTargets, initialTarget } from '../cards/TargetFields.tsx';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { HandFace, useEntryName } from './HandFaces.tsx';

/** Fächer: Drehung je Karte, Absenkung zum Rand hin, Zugweg zum Ausspielen. */
const FAN_DEGREES = 4;
const FAN_DROP = 4;
const FLICK_PX = 90;
/** Bis zu so vielen Karten liegt die Hand locker; darüber rücken die Karten enger. */
const ROOMY = 5;
const LIFT = { y: -64, scale: 1.2, rotate: 0, zIndex: 40 } as const;
const SPRING = { type: 'spring', stiffness: 320, damping: 26 } as const;
/** Neue Karten kommen von unten herein, gespielte fliegen nach oben aufs Spielfeld. */
const DEALT = { y: 220, opacity: 0 } as const;
const PLAYED = { y: -260, opacity: 0, scale: 1.25 } as const;

/** Lage im Fächer: zur Mitte hin gerade und oben, nach außen gedreht und tiefer. */
const fanned = (offset: number) => ({
  y: offset * offset * FAN_DROP,
  rotate: offset * FAN_DEGREES,
  opacity: 1,
  scale: 1,
});

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
}

/** Antippen oder nach oben Ziehen spielt aus; nach dem Ziehen zählt der Klick nicht doppelt. */
function useGesture(playable: boolean, onPlay: () => void) {
  const dragged = useRef(false);
  return {
    drag: playable ? ('y' as const) : false,
    dragSnapToOrigin: true,
    onDragStart: () => (dragged.current = true),
    onDragEnd: (_: unknown, info: PanInfo) => {
      if (info.offset.y < -FLICK_PX && playable) onPlay();
    },
    onClick: () => {
      if (!dragged.current && playable) onPlay();
      dragged.current = false;
    },
  };
}

/** Eine Karte im Fächer: anheben zum Lesen, antippen oder nach oben ziehen zum Ausspielen. */
function HandCard({ game, entry, offset, onPlay }: CardProps): ReactElement {
  const t = useT();
  const name = useEntryName();
  const motionOn = useSettingsStore((state) => state.animations);
  const present = useIsPresent();
  const gesture = useGesture(entry.playable && present, onPlay);
  return (
    <motion.button
      type="button"
      className={classOf(entry)}
      data-kind={entry.kind}
      data-look={lookOf(entry)}
      data-testid={testIdOf(entry)}
      data-leaving={present ? undefined : true}
      aria-label={name(entry)}
      aria-disabled={!entry.playable}
      title={t(entry.playable ? 'playGesture' : 'notPlayableNow')}
      initial={DEALT}
      animate={fanned(offset)}
      exit={PLAYED}
      whileHover={LIFT}
      whileFocus={LIFT}
      transition={motionOn ? SPRING : { duration: 0 }}
      {...gesture}
    >
      <HandFace game={game} entry={entry} />
    </motion.button>
  );
}

/** Aktionskarte mit Zielen: Antippen öffnet die Zielwahl direkt über der Karte. */
function TargetedCard(props: Omit<CardProps, 'onPlay'>): ReactElement {
  const [open, setOpen] = useState(false);
  const { game, entry } = props;
  if (entry.kind !== 'action') return <HandCard {...props} onPlay={() => undefined} />;
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Anchor asChild>
        <div className="hand-anchor">
          <HandCard {...props} onPlay={() => setOpen(true)} />
        </div>
      </Popover.Anchor>
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

/** In der Strategiephase wählt man nur über die Hand; dann liegt sie offen, sonst eingeklappt. */
const neededNow = (game: GameState, entries: readonly HandEntry[]): boolean =>
  game.phase === 'strategy' && entries.some((entry) => entry.kind === 'pick' && entry.playable);

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
  const handOpen = useSettingsStore((state) => state.handOpen);
  const needed = neededNow(game, entries);
  const raised = handOpen || needed;
  const middle = (entries.length - 1) / 2;
  return (
    <section
      className={raised ? 'hand-dock raised' : 'hand-dock tucked'}
      aria-label={t('yourHand')}
      data-tutorial="hand"
      style={{ '--crowd': Math.max(0, entries.length - ROOMY) } as CSSProperties}
    >
      {entries.length > 0 && <HandOwner game={game} needed={needed} />}
      <AnimatePresence initial={false}>
        {entries.map((entry, index) => {
          const props = { game, entry, offset: index - middle };
          return needsTargets(entry) ? (
            <TargetedCard key={entryKey(entry)} {...props} />
          ) : (
            <HandCard key={entryKey(entry)} {...props} onPlay={() => play(entry)} />
          );
        })}
      </AnimatePresence>
    </section>
  );
}
