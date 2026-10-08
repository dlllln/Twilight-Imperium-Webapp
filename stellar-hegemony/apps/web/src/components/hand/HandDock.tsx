import * as Popover from '@radix-ui/react-popover';
import { type GameState, type PlayerId, systemId } from '@stellar/domain';
import { AnimatePresence, motion, type PanInfo, useIsPresent } from 'motion/react';
import { type CSSProperties, type ReactElement, useRef, useState } from 'react';
import { useGameStore, useHumanActor, useViewer } from '../../game-store.ts';
import { lookOf } from '../../hand/card-look.ts';
import { entryKey, type HandEntry, handEntries } from '../../hand/hand-model.ts';
import { useHandStore } from '../../hand/hand-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import { useT } from '../../use-translation.ts';
import { PlayControls } from '../cards/CardItem.tsx';
import { hasTargets, initialTarget } from '../cards/TargetFields.tsx';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { useSidebarStore } from '../game/sidebar-store.ts';
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

const testIdOf = (entry: HandEntry): string | undefined =>
  entry.kind === 'action' ? `card-${entry.card.definition.id}` : undefined;

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
  if (entry.kind === 'action') {
    const { card, player } = entry;
    const target = initialTarget(card.targets);
    return { type: 'PlayActionCard', issuedBy: player, card: card.definition.id, target } as const;
  }
  return actor === null ? null : turnCommand(entry, actor, selected);
}

/** Ausspielen: Befehl senden; die strategische Aktion öffnet ihr Formular in der Seitenleiste. */
function usePlay(game: GameState): (entry: HandEntry) => void {
  const send = useGameStore((state) => state.send);
  const actor = useHumanActor(game);
  const selected = useGameStore((state) => state.selected);
  return (entry) => {
    if (entry.kind === 'strategic' && actor !== null) {
      useHandStore.getState().choose({ player: actor, card: entry.card.id });
      useSidebarStore.getState().setTab('turn');
    }
    const command = commandFor(entry, actor, selected);
    if (command !== null) send(command);
  };
}

const needsTargets = (entry: HandEntry): boolean =>
  entry.kind === 'action' && hasTargets(entry.card.targets);

const classOf = (entry: HandEntry): string =>
  `hand-card${entry.kind === 'action' ? ' action-card' : ''} ${entry.playable ? 'playable' : 'idle'}`;

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

/** Wer sieht welche Hand: der Spieler am Zug, online der eigene Platz. */
function useEntries(game: GameState): readonly HandEntry[] {
  const actor = useHumanActor(game);
  const viewer: PlayerId | null = useViewer(game);
  const selected = useGameStore((state) => state.selected);
  const chosen = useHandStore((state) => state.chosen);
  const choosing = chosen !== null && chosen.player === actor;
  return handEntries({ game, actor, viewer, selected, choosing });
}

/** Wessen Hand gerade zu sehen ist; am Hot-Seat-Bildschirm wechselt sie mit dem Zug. */
function HandOwner({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const owner = useViewer(game);
  if (owner === null) return null;
  return (
    <p className="hand-owner">
      {t('handOf')} <PlayerTag game={game} id={owner} />
    </p>
  );
}

/**
 * Die Hand am unteren Rand der Karte: Strategiekarten in der Strategiephase, im Zug die
 * strategische und taktische Aktion und Passen, dazu die Aktionskarten.
 */
export function HandDock({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const entries = useEntries(game);
  const play = usePlay(game);
  const middle = (entries.length - 1) / 2;
  return (
    <section
      className="hand-dock"
      aria-label={t('yourHand')}
      data-tutorial="hand"
      style={{ '--crowd': Math.max(0, entries.length - ROOMY) } as CSSProperties}
    >
      {entries.length > 0 && <HandOwner game={game} />}
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
