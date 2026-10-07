import {
  type ContentPort,
  type DecisionContext,
  findPlayer,
  type GameCommand,
  type GameState,
  type PlayerId,
  type PlayerState,
  withTechnologies,
} from '@stellar/domain';

/**
 * Was ein Bot für eine Entscheidung sieht: Spielstand, eigener Platz und ein Kontext,
 * in dem alle Einheitenwerte schon Technologien und Fraktionsfähigkeiten enthalten.
 */
export interface BotView {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly context: DecisionContext;
}

/** Ein Planer schlägt Commands vor, die besten zuerst; leer heißt „nicht zuständig“. */
export type Planner = (view: BotView) => readonly GameCommand[];

export const botView = (state: GameState, player: PlayerId, context: DecisionContext): BotView => ({
  state,
  player,
  context: withTechnologies(context, state),
});

export const contentOf = (view: BotView): ContentPort => view.context.content;

export function me(view: BotView): PlayerState {
  const player = findPlayer(view.state, view.player);
  if (player === undefined) throw new Error(`Unbekannter Spieler ${view.player}`);
  return player;
}

export const issued = (view: BotView) => ({ issuedBy: view.player }) as const;
