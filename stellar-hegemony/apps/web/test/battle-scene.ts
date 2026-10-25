import {
  adjacentSystemIds,
  type GameState,
  type PlayerId,
  type SystemId,
  type Unit,
  unitId,
  unitTypeId,
} from '@stellar/domain';
import { homeSystemOf } from '../src/card-view.ts';
import { content } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';

/*
 * Kampfszenen für die Kampfmatte: Der Aktive hat ein freies Nachbarsystem seiner Heimat
 * angegriffen; dort steht der Verteidiger. In einem Nachbarsystem des Kampfs wartet ein Träger
 * des Verteidigers als Ziel für den Rückzug.
 */

export const figure = (id: string, type: string, owner: PlayerId): Unit => ({
  id: unitId(id),
  type: unitTypeId(type),
  owner,
  damaged: false,
});

export interface BattleScene {
  readonly game: GameState;
  readonly attacker: PlayerId;
  readonly defender: PlayerId;
  readonly system: SystemId;
  readonly refuge: SystemId;
}

const empty = (state: GameState, id: SystemId): boolean => {
  const system = state.systems[id];
  return system?.anomaly === undefined && system?.spaceUnits.length === 0;
};

function neighbours(state: GameState, id: SystemId): readonly SystemId[] {
  const system = state.systems[id];
  if (system === undefined) throw new Error('kein System');
  return adjacentSystemIds(state.systems, system);
}

/** Ein leeres Kampfsystem neben der Heimat und ein leeres Rückzugsziel daneben. */
function battlefield(state: GameState, attacker: PlayerId): readonly [SystemId, SystemId] {
  const home = homeSystemOf(state, attacker, content);
  if (home === null) throw new Error('keine Heimat');
  for (const system of neighbours(state, home).filter((id) => empty(state, id))) {
    const refuge = neighbours(state, system).find((id) => id !== home && empty(state, id));
    if (refuge !== undefined) return [system, refuge];
  }
  throw new Error('kein Schlachtfeld');
}

type Pending = (
  attacker: PlayerId,
  defender: PlayerId,
) => {
  readonly pendingHits: readonly { readonly player: PlayerId; readonly hits: number }[];
  readonly awaitingRetreat: readonly PlayerId[];
};

/** Schlachtschiff und Kreuzer greifen Kreuzer und Zerstörer an; `pending` sagt, was offen ist. */
export function battleScene(pending: Pending): BattleScene {
  const state = pickAll(started());
  const attacker = state.actionPhase?.active as PlayerId;
  const defender = state.players.find((player) => player.id !== attacker)?.id as PlayerId;
  const [system, refuge] = battlefield(state, attacker);
  const fleets = [
    figure('dread', 'dreadnought', attacker),
    figure('kreuzer', 'cruiser', attacker),
    figure('feind-kreuzer', 'cruiser', defender),
    figure('feind-zerstoerer', 'destroyer', defender),
  ];
  const { pendingHits, awaitingRetreat } = pending(attacker, defender);
  const combat = { attacker, defender, round: 1, awaitingRetreat, retreat: null, rolled: true };
  const tactical = { system, step: 'spaceCombat', pendingHits, combat, windows: [], bonuses: [] };
  const tiles = state.systems;
  const systems = {
    ...tiles,
    [system]: { ...tiles[system], spaceUnits: fleets },
    [refuge]: { ...tiles[refuge], spaceUnits: [figure('zuflucht', 'carrier', defender)] },
  };
  const actionPhase = state.actionPhase && { ...state.actionPhase, tactical };
  const game = { ...state, systems, actionPhase } as GameState;
  return { game, attacker, defender, system, refuge };
}

/** Der Angreifer muss zwei Treffer verteilen. */
export const hitScene = (): BattleScene =>
  battleScene((attacker) => ({
    pendingHits: [{ player: attacker, hits: 2 }],
    awaitingRetreat: [],
  }));

/** Vor der Runde fragt der Kampf den Verteidiger nach einem Rückzug. */
export const retreatScene = (): BattleScene =>
  battleScene((_attacker, defender) => ({ pendingHits: [], awaitingRetreat: [defender] }));
