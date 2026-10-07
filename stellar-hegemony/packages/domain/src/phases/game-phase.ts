import type { GameState, PhaseName } from '../game/game-state.ts';

/**
 * State Pattern: jede Phase kennt die Commands, die in ihr erlaubt sind, und
 * ihre Nachfolgephase. Der Dispatcher fragt die aktuelle Phase, statt
 * Phasenprüfungen über alle Handler zu verteilen.
 */
export interface GamePhase {
  readonly name: PhaseName;
  accepts(commandType: string): boolean;
  next(state: GameState): PhaseName;
}

abstract class BasePhase implements GamePhase {
  abstract readonly name: PhaseName;
  protected abstract readonly commands: readonly string[];

  accepts(commandType: string): boolean {
    return this.commands.includes(commandType);
  }

  abstract next(state: GameState): PhaseName;
}

export class SetupPhase extends BasePhase {
  readonly name = 'setup';
  protected readonly commands = ['SeatPlayer', 'ImportMap', 'GenerateGalaxy', 'StartGame'];
  next(): PhaseName {
    return 'strategy';
  }
}

export class StrategyPhase extends BasePhase {
  readonly name = 'strategy';
  protected readonly commands = ['PickStrategyCard', 'KeepSecretObjectives'];
  next(): PhaseName {
    return 'action';
  }
}

export class ActionPhase extends BasePhase {
  readonly name = 'action';
  protected readonly commands = [
    'PerformStrategicAction',
    'ResolveSecondary',
    'DeclineSecondary',
    'Pass',
    'ActivateSystem',
    'MoveShips',
    'EndTacticalAction',
    'AssignHits',
    'DeclareRetreat',
    'Bombard',
    'CommitGroundForces',
    'ProduceUnits',
    'ProposeTransaction',
    'AcceptTransaction',
    'RejectTransaction',
    'ScoreObjective',
    'KeepSecretObjectives',
  ];
  next(): PhaseName {
    return 'status';
  }
}

/** RR 73: Aufträge werten, Marker erhalten und umverteilen; der Rest läuft automatisch. */
export class StatusPhase extends BasePhase {
  readonly name = 'status';
  protected readonly commands = [
    'ScoreObjective',
    'EndScoring',
    'AllocateCommandTokens',
    'KeepSecretObjectives',
  ];
  /** RR 36: Die Agendaphase gibt es erst, wenn der Marker auf der Zentrumswelt entfernt wurde. */
  next(state: GameState): PhaseName {
    return state.centerTokenRemoved ? 'agenda' : 'strategy';
  }
}

export class AgendaPhase extends BasePhase {
  readonly name = 'agenda';
  protected readonly commands: readonly string[] = [];
  next(): PhaseName {
    return 'strategy';
  }
}

export class GameOverPhase extends BasePhase {
  readonly name = 'gameOver';
  protected readonly commands: readonly string[] = [];
  next(): PhaseName {
    return 'gameOver';
  }
}

const PHASES: Readonly<Record<PhaseName, GamePhase>> = {
  setup: new SetupPhase(),
  strategy: new StrategyPhase(),
  action: new ActionPhase(),
  status: new StatusPhase(),
  agenda: new AgendaPhase(),
  gameOver: new GameOverPhase(),
};

export const phaseOf = (state: GameState): GamePhase => PHASES[state.phase];
