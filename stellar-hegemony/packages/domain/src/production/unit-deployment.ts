import type { DeployTrigger } from '../faction/faction-ability.ts';
import { findPlayer, type GameState } from '../game/game-state.ts';
import { commanderAbilities } from '../leaders/leader-queries.ts';
import type { ContentPort } from '../ports/content-port.ts';
import type { PlanetId, PlayerId } from '../shared/ids.ts';
import { UnitNumbering } from '../unit/unit-numbering.ts';
import type { UnitsDeployed } from './production-events.ts';
import { supplyAllows } from './unit-supply.ts';

/** Wo und wodurch eingesetzt wird; `fires` prüft den Auslöser einer Fähigkeit. */
export interface DeployInput {
  readonly state: GameState;
  readonly player: PlayerId;
  readonly planet: PlanetId;
  readonly content: ContentPort;
  readonly fires: (trigger: DeployTrigger) => boolean;
}

/** Auslöser „Planet übernommen“: nur, wenn ihn vorher ein anderer Spieler kontrolliert hat. */
export const planetCaptured =
  (captured: boolean) =>
  (trigger: DeployTrigger): boolean =>
    captured && trigger.kind === 'planetCaptured';

/** Auslöser „Bodentruppen produziert“: mindestens so viele wie die Fähigkeit verlangt. */
export const groundForcesProduced =
  (count: number) =>
  (trigger: DeployTrigger): boolean =>
    trigger.kind === 'groundForcesProduced' && count >= trigger.minimum;

/** Fraktionsfähigkeiten und freie Kommandanten (PoK Anführer) können Einheiten einsetzen. */
const abilitiesOf = (state: GameState, player: PlayerId, content: ContentPort) => {
  const faction = findPlayer(state, player)?.faction;
  const own = content.factions.find((candidate) => candidate.id === faction)?.abilities ?? [];
  return [...own, ...commanderAbilities(state, player, content)];
};

/**
 * PoK Mech: Fähigkeiten mit passendem Auslöser setzen je eine Einheit aus der Verstärkung
 * auf den Planeten, solange der Vorrat (RR 24.5) reicht. Kein Vorrat, kein Einsatz.
 */
export function deployEvents(input: DeployInput): readonly UnitsDeployed[] {
  const { state, player, planet, content } = input;
  const numbering = new UnitNumbering(state.nextUnitNumber);
  return abilitiesOf(state, player, content).flatMap((ability) => {
    const rule = ability.deploy;
    if (rule === undefined || !input.fires(rule.trigger)) return [];
    const definition = content.units.find(rule.unit, player);
    if (definition === undefined || !supplyAllows(state, player, definition, 1)) return [];
    const units = numbering.create(player, [{ type: rule.unit, count: 1 }]);
    return [{ type: 'UnitsDeployed', player, ability: ability.id, planet, units }];
  });
}
