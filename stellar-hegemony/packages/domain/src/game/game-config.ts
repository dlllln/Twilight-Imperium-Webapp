import { type DomainError, domainError } from '../shared/domain-error.ts';
import { combine, ensure, map, type Result } from '../shared/result.ts';
import type { RuleNumbers } from './rule-numbers.ts';

/** Variante einer Partie (Protected Variations): Spielerzahl, Siegpunkte, Regelwerte. */
export interface GameConfig {
  readonly playerCount: number;
  readonly victoryPointsToWin: number;
  readonly rules: RuleNumbers;
}

export function validateGameConfig(config: GameConfig): Result<GameConfig, DomainError> {
  const { playerCount, victoryPointsToWin, rules } = config;
  const checks = [
    ensure(
      Number.isInteger(playerCount) &&
        playerCount >= rules.minPlayers &&
        playerCount <= rules.maxPlayers,
      () =>
        domainError('config.playerCount', 'Spielerzahl außerhalb des erlaubten Bereichs', {
          playerCount,
          min: rules.minPlayers,
          max: rules.maxPlayers,
        }),
    ),
    ensure(rules.victoryPointOptions.includes(victoryPointsToWin), () =>
      domainError('config.victoryPoints', 'Siegpunktziel nicht erlaubt', { victoryPointsToWin }),
    ),
  ];
  return map(combine(checks), () => config);
}

/** Regel 76: Bei wenigen Spielern wählt jeder zwei Strategiekarten. */
export function strategyCardsPerPlayer(config: GameConfig): number {
  const allotment = config.rules.strategyCardAllotment;
  return config.playerCount <= allotment.fewPlayersThreshold
    ? allotment.cardsWhenFewPlayers
    : allotment.cardsOtherwise;
}
