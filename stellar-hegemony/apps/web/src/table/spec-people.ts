import type { PlayerId } from '@stellar/domain';
import { strategyCommand } from './spec-pools.ts';
import type { PlayersPlan, SpecContext, TableAction, TableSpec } from './spec-types.ts';
import { playerTarget, type TargetRef, targetKey, type TargetState } from './target-ref.ts';

/*
 * Menschen am Tisch: Bei der Politik (primär, RR 61.2) wandert der Sprechermarker auf das Bild
 * eines Mitspielers, der ihn noch nicht hat. Beim Handel (primär, RR 34.4) bekommen angetippte
 * Mitspieler einen Freibrief und nutzen die Sekundärfähigkeit ohne Strategiemarker.
 */

export type PeopleSpec = TableSpec<PlayersPlan, TableAction>;

const plan = (players: readonly PlayerId[]): PlayersPlan => ({ kind: 'players', players });

const keyOf = (player: PlayerId): string => targetKey(playerTarget(player));

/** Wer Sprecher werden kann: alle außer dem jetzigen Sprecher, in Sitzreihenfolge. */
const candidatesOf = (ctx: SpecContext): readonly PlayerId[] =>
  ctx.game.players.filter((player) => player.id !== ctx.game.speaker).map((player) => player.id);

/** Wer einen Freibrief bekommen kann: alle Mitspieler außer dem Handelnden. */
const othersOf = (ctx: SpecContext): readonly PlayerId[] =>
  ctx.game.players.filter((player) => player.id !== ctx.actor).map((player) => player.id);

/** Erlaubte Ziele leuchten, gewählte Mitspieler sind markiert. */
function peopleTargets(
  offered: readonly PlayerId[],
  chosen: readonly PlayerId[],
): ReadonlyMap<string, TargetState> {
  const states = new Map<string, TargetState>();
  for (const player of offered) states.set(keyOf(player), 'legal');
  for (const player of chosen) states.set(keyOf(player), 'chosen');
  return states;
}

function choose(ctx: SpecContext, draft: PlayersPlan, action: TableAction): PlayersPlan {
  if (action.kind !== 'player' || !candidatesOf(ctx).includes(action.player)) return draft;
  return plan([action.player]);
}

const NOWHERE: ReadonlySet<string> = new Set();

/** Der Sprechermarker darf auf das Bild jedes möglichen neuen Sprechers. */
const speakerLegal = (ctx: SpecContext, _draft: PlayersPlan, piece: TargetRef) =>
  piece.kind === 'speaker' ? new Set(candidatesOf(ctx).map(keyOf)) : NOWHERE;

export const POLITICS_SPEC: PeopleSpec = {
  id: 'politics',
  hint: () => 'tableHintPolitics',
  confirm: () => 'confirm',
  initial: (ctx) => plan(candidatesOf(ctx).slice(0, 1)),
  apply: choose,
  targets: (ctx, draft) => peopleTargets(candidatesOf(ctx), draft.players),
  progress: (_ctx, draft) => ({
    done: draft.players.length,
    needed: 1,
    ready: draft.players.length === 1,
  }),
  command: (ctx, draft) =>
    strategyCommand(ctx, { mechanic: 'politics', speaker: draft.players[0] ?? null }),
  legal: speakerLegal,
};

function toggle(ctx: SpecContext, draft: PlayersPlan, action: TableAction): PlayersPlan {
  if (action.kind !== 'player' || !othersOf(ctx).includes(action.player)) return draft;
  const { players } = draft;
  const has = players.includes(action.player);
  return plan(has ? players.filter((id) => id !== action.player) : [...players, action.player]);
}

export const TRADE_SPEC: PeopleSpec = {
  id: 'trade',
  hint: () => 'tableHintTrade',
  confirm: () => 'confirm',
  initial: () => plan([]),
  apply: toggle,
  targets: (ctx, draft) => peopleTargets(othersOf(ctx), draft.players),
  progress: (_ctx, draft) => ({ done: draft.players.length, needed: 0, ready: true }),
  command: (ctx, draft) => strategyCommand(ctx, { mechanic: 'trade', freeFor: draft.players }),
};
