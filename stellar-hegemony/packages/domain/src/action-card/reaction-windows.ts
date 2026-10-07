import type { ContentPort } from '../ports/content-port.ts';
import type { GameEvent } from '../game/game-events.ts';
import type { GameState } from '../game/game-state.ts';
import type { TacticalActionState } from '../phases/turn-state.ts';
import type { WindowKind } from './action-card-definition.ts';
import { respondersFor } from './card-timing.ts';

interface WindowTrigger {
  readonly kind: WindowKind;
  readonly key: (tactical: TacticalActionState) => string;
  readonly applies: (tactical: TacticalActionState) => boolean;
}

const combatRoundDue = ({ step, combat, pendingHits }: TacticalActionState): boolean =>
  step === 'spaceCombat' &&
  combat !== null &&
  combat.round > 0 &&
  !combat.rolled &&
  combat.awaitingRetreat.length === 0 &&
  pendingHits.length === 0;

/** Wo in der Taktikaktion Zeitfenster für Reaktionen liegen (RR 3.10). */
const TRIGGERS: readonly WindowTrigger[] = [
  { kind: 'afterActivation', key: () => 'afterActivation', applies: (t) => t.step === 'movement' },
  {
    kind: 'combatRound',
    key: (t) => `combatRound-${String(t.combat?.round ?? 0)}`,
    applies: combatRoundDue,
  },
  { kind: 'invasion', key: () => 'invasion', applies: (t) => t.step === 'invasion' },
];

/**
 * Öffnet das fällige Zeitfenster, falls jemand eine passende Karte spielen könnte.
 * Jedes Fenster wird je Taktikaktion (bzw. Kampfrunde) höchstens einmal angeboten.
 */
export function windowEvents(state: GameState, content: ContentPort): readonly GameEvent[] {
  const tactical = state.actionPhase?.tactical;
  if (tactical == null) return [];
  const trigger = TRIGGERS.find(
    (candidate) =>
      candidate.applies(tactical) && !tactical.windows.includes(candidate.key(tactical)),
  );
  if (trigger === undefined) return [];
  const awaiting = respondersFor(state, trigger.kind, content);
  if (awaiting.length === 0) return [];
  return [
    { type: 'ReactionWindowOpened', kind: trigger.kind, key: trigger.key(tactical), awaiting },
  ];
}
