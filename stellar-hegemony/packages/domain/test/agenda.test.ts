import { describe, expect, it } from 'vitest';
import {
  type AgendaEffect,
  agendaActor,
  agendaEffectEvents,
  evolveGame,
  type GameEvent,
  lawVotes,
  currentAgenda,
  decideGameCommand,
  type GameCommand,
  type GameState,
  planetId,
  type PlayerId,
  updatePlayer,
  voteOrder,
  votingPower,
} from '../src/index.ts';
import { AC, AG, BLUE, content, contextWith, RED, T, unit } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, statusPhaseGame, step } from './game-flow.ts';

const prime = (player: PlayerId) => planetId(`${player}-prime`);
const ALPHA = planetId('alpha-1');
const BETA = planetId('beta-1');

const endScoring = (issuedBy: PlayerId) => ({ type: 'EndScoring', issuedBy }) as const;

const allocate = (state: GameState, issuedBy: PlayerId): GameCommand => {
  const pools = state.players.find((player) => player.id === issuedBy)?.commandPools;
  const current = pools ?? { tactic: 0, fleet: 0, strategy: 0 };
  return {
    type: 'AllocateCommandTokens',
    issuedBy,
    pools: { ...current, tactic: current.tactic + 2 },
  };
};

/** Statusphase mit entferntem Zentrumsmarker bis zum Ende; danach läuft die Agendaphase. */
function agendaGame(deck: readonly string[], prepare = (state: GameState) => state): GameState {
  const status = prepare({
    ...statusPhaseGame(),
    centerTokenRemoved: true,
    agendaDeck: { deck: deck.map(AG), discard: [] },
  });
  const scored = run(status, [endScoring(RED), endScoring(BLUE), endScoring(GREEN)]);
  return [RED, BLUE, GREEN].reduce(
    (current, player) => run(current, [allocate(current, player)]),
    scored,
  );
}

const vote = (issuedBy: PlayerId, outcome: string, planets = [prime(issuedBy)]) =>
  ({ type: 'CastVotes', issuedBy, outcome, planets }) as const;
const abstain = (issuedBy: PlayerId) => ({ type: 'Abstain', issuedBy }) as const;
const breakTie = (issuedBy: PlayerId, outcome: string) =>
  ({ type: 'BreakTie', issuedBy, outcome }) as const;

const codeOf = (state: GameState, command: GameCommand) => {
  const result = decideGameCommand(state, command, contextWith());
  return result.ok ? 'ok' : result.error.code;
};

const playerOf = (state: GameState, id: PlayerId) =>
  state.players.find((player) => player.id === id) as GameState['players'][number];

const types = (events: readonly { type: string }[]) => events.map((event) => event.type);

/**
 * Der erste Wähler mit bereitem Heimatplaneten entscheidet mit 2 Stimmen, die anderen
 * enthalten sich (in der ersten Agenda Blau, in der zweiten Grün).
 */
function decide(state: GameState, outcome: string): GameState {
  const awaiting = state.agendaPhase?.awaiting ?? [];
  const voter = awaiting.find((player) => state.planets[prime(player)]?.exhausted === false);
  return run(
    state,
    awaiting.map((player) => (player === voter ? vote(player, outcome) : abstain(player))),
  );
}

const withController = (state: GameState, planet: string, player: PlayerId): GameState => ({
  ...state,
  planets: {
    ...state.planets,
    [planet]: { ...(state.planets[planet] as GameState['planets'][string]), controller: player },
  },
});

describe('Beginn der Agendaphase (RR 36.4, RR 2.2)', () => {
  it('RR 71.1: solange der Zentrumsmarker liegt, folgt direkt die nächste Strategiephase', () => {
    const status = { ...statusPhaseGame(), agendaDeck: { deck: [AG('stimulus')], discard: [] } };
    const scored = run(status, [endScoring(RED), endScoring(BLUE), endScoring(GREEN)]);
    const done = [RED, BLUE, GREEN].reduce(
      (current, player) => run(current, [allocate(current, player)]),
      scored,
    );
    expect(done.phase).toBe('strategy');
  });

  it('RR 36.4: ohne Zentrumsmarker deckt der Sprecher nach der Statusphase die erste Agenda auf', () => {
    const state = agendaGame(['stimulus', 'audit']);
    expect(state.phase).toBe('agenda');
    expect(state.agendaPhase).toMatchObject({ number: 1, agenda: AG('stimulus'), tied: null });
    expect(state.agendaDeck.deck).toEqual([AG('audit')]);
  });

  it('RR 72.2: links vom Sprecher beginnend im Uhrzeigersinn, der Sprecher stimmt zuletzt', () => {
    const state = agendaGame(['stimulus']);
    expect(state.speaker).toBe(RED);
    expect(voteOrder(state)).toEqual([BLUE, GREEN, RED]);
    expect(state.agendaPhase?.awaiting).toEqual([BLUE, GREEN, RED]);
    expect(agendaActor(state)).toBe(BLUE);
    expect(codeOf(state, vote(RED, 'for'))).toBe('agenda.notYourTurn');
    expect(codeOf(state, abstain(GREEN))).toBe('agenda.notYourTurn');
  });

  it('RR 2.2: ist der Stapel leer, wird die Ablage gemischt', () => {
    const state = agendaGame([], (s) => ({
      ...s,
      agendaDeck: { deck: [], discard: [AG('stimulus')] },
    }));
    expect(state.agendaPhase?.agenda).toBe(AG('stimulus'));
    expect(state.agendaDeck.discard).toEqual([]);
  });

  it('RR 2.4: ohne Agenden endet die Phase sofort mit der nächsten Runde', () => {
    const state = agendaGame([]);
    expect(state).toMatchObject({ phase: 'strategy', round: 2, agendaPhase: null });
  });
});

describe('Abstimmen (RR 2.5–2.14)', () => {
  it('RR 2.6: Stimmen sind der Einfluss der erschöpften Planeten; sie bleiben erschöpft', () => {
    const { state, events } = step(agendaGame(['stimulus', 'audit']), vote(BLUE, 'for'));
    expect(events).toEqual([
      { type: 'VotesCast', player: BLUE, outcome: 'for', planets: [prime(BLUE)], votes: 2 },
    ]);
    expect(state.planets[prime(BLUE)]?.exhausted).toBe(true);
    expect(currentAgenda(state, content)?.counts.get('for')).toBe(2);
    expect(agendaActor(state)).toBe(GREEN);
  });

  it('RR 2.13: Handelswaren zählen nicht; ohne Stimmen bleibt nur die Enthaltung', () => {
    const rich = agendaGame(['stimulus'], (s) =>
      updatePlayer(s, BLUE, (p) => ({ ...p, tradeGoods: 5 })),
    );
    expect(codeOf(rich, vote(BLUE, 'for', []))).toBe('agenda.noVotes');
    expect(codeOf(rich, abstain(BLUE))).toBe('ok');
  });

  it('RR 2.6: nur eigene, bereite Planeten', () => {
    const state = agendaGame(['stimulus']);
    expect(codeOf(state, vote(BLUE, 'for', [prime(RED)]))).not.toBe('ok');
    const exhausted = run(state, [vote(BLUE, 'for'), abstain(GREEN)]);
    expect(codeOf(exhausted, vote(RED, 'for', [prime(BLUE)]))).not.toBe('ok');
  });

  it('RR 2.8: bei Dafür/Dagegen sind nur diese beiden Ergebnisse wählbar', () => {
    const state = agendaGame(['stimulus']);
    expect(codeOf(state, vote(BLUE, 'maybe'))).toBe('agenda.invalidOutcome');
    expect(currentAgenda(state, content)?.outcomes).toEqual(['for', 'against']);
  });

  it('RR 2.10: bei einer Wahl stimmt man für einen Spieler, auch für sich selbst', () => {
    const state = agendaGame(['medal']);
    expect(currentAgenda(state, content)?.outcomes).toEqual([RED, BLUE, GREEN]);
    expect(codeOf(state, vote(BLUE, BLUE))).toBe('ok');
  });

  it('RR 2.12: bei einer Planetenwahl zählen nur Planeten mit Besitzer und passendem Merkmal', () => {
    const state = agendaGame(['culture'], (s) => withController(s, BETA, GREEN));
    expect(currentAgenda(state, content)?.outcomes).toEqual([BETA]);
    const outer = agendaGame(['survey'], (s) => withController(s, ALPHA, BLUE));
    expect(currentAgenda(outer, content)?.outcomes).toEqual([ALPHA]);
  });
});

describe('Ergebnis abhandeln (RR 2.2 iii, RR 2.19)', () => {
  it('RR 2.2: die Mehrheit entscheidet; die Direktive wirkt und kommt auf die Ablage', () => {
    const state = decide(agendaGame(['stimulus', 'audit']), 'for');
    expect(state.players.map((player) => player.tradeGoods)).toEqual([2, 2, 2]);
    expect(state.agendaDeck.discard).toEqual([AG('stimulus')]);
    expect(state.agendaPhase).toMatchObject({ number: 2, agenda: AG('audit'), votes: [] });
  });

  it('RR 1.6: gewinnt Dagegen, gilt die Gegenseite der Karte', () => {
    const start = agendaGame(['stimulus', 'audit'], (s) =>
      updatePlayer(s, GREEN, (p) => ({ ...p, commodities: 0 })),
    );
    const state = decide(start, 'against');
    expect(playerOf(state, GREEN).commodities).toBe(playerOf(state, GREEN).commodityLimit);
    expect(playerOf(state, GREEN).tradeGoods).toBe(0);
  });

  it('RR 2.19: bei Gleichstand entscheidet der Sprecher zwischen den Gleichen', () => {
    const start = agendaGame(['stimulus', 'audit']);
    const tied = run(start, [vote(BLUE, 'for'), vote(GREEN, 'against'), abstain(RED)]);
    expect(tied.agendaPhase?.tied).toEqual(['for', 'against']);
    expect(agendaActor(tied)).toBe(RED);
    expect(codeOf(tied, breakTie(BLUE, 'for'))).toBe('agenda.notSpeaker');
    expect(codeOf(tied, breakTie(RED, 'maybe'))).toBe('agenda.invalidOutcome');
    const decided = run(tied, [breakTie(RED, 'for')]);
    expect(playerOf(decided, RED).tradeGoods).toBe(2);
    expect(codeOf(decided, breakTie(RED, 'for'))).toBe('agenda.noTie');
  });

  it('RR 2.19: enthalten sich alle, wählt der Sprecher unter allen Ergebnissen', () => {
    const state = run(agendaGame(['stimulus']), [abstain(BLUE), abstain(GREEN), abstain(RED)]);
    expect(state.agendaPhase?.tied).toEqual(['for', 'against']);
  });

  it('RR 2.19: gibt es keinen wählbaren Planeten, wird die Agenda ohne Wirkung abgelegt', () => {
    const start = agendaGame(['survey', 'stimulus']);
    const state = run(start, [abstain(BLUE), abstain(GREEN), abstain(RED)]);
    expect(state.agendaDeck.discard).toContain(AG('survey'));
    expect(state.agendaPhase).toMatchObject({ number: 2, agenda: AG('stimulus'), tied: null });
  });

  it('RR 2.4: nach zwei Agenden werden alle Planeten bereit und die nächste Runde beginnt', () => {
    const first = decide(agendaGame(['stimulus', 'audit']), 'for');
    const { state, events } = step(
      run(first, [abstain(BLUE), vote(GREEN, 'against')]),
      abstain(RED),
    );
    expect(types(events).slice(-2)).toEqual(['AgendaPhaseEnded', 'StrategyPhaseStarted']);
    expect(state).toMatchObject({ phase: 'strategy', round: 2, agendaPhase: null });
    expect(Object.values(state.planets).every((planet) => !planet.exhausted)).toBe(true);
  });

  it('RR 2.6: wer in der ersten Agenda Planeten erschöpft hat, kann sie in der zweiten nicht nutzen', () => {
    const first = decide(agendaGame(['stimulus', 'audit']), 'for');
    expect(codeOf(first, vote(BLUE, 'for'))).toBe('planet.alreadyExhausted');
  });
});

describe('Gesetze (RR 1.3–1.5)', () => {
  it('RR 1.3: ein angenommenes Gesetz bleibt dauerhaft in Kraft', () => {
    const state = decide(agendaGame(['charter', 'audit']), 'for');
    expect(state.laws).toEqual([
      {
        agenda: AG('charter'),
        effect: { kind: 'commodityLimitAll', delta: 1 },
        owner: null,
        planet: null,
      },
    ]);
    expect(state.players.map((player) => player.commodityLimit)).toEqual([4, 4, 4]);
    expect(state.agendaDeck.discard).toEqual([]);
  });

  it('RR 1.6: wird ein Gesetz abgelehnt, kommt es auf die Ablage', () => {
    const state = decide(agendaGame(['charter', 'audit']), 'against');
    expect(state.laws).toEqual([]);
    expect(state.agendaDeck.discard).toEqual([AG('charter')]);
    expect(playerOf(state, BLUE).tradeGoods).toBe(1);
    expect(playerOf(state, GREEN).tradeGoods).toBe(0);
  });

  it('RR 1.3: ein Gesetz kann Regelwerte ändern (Handkartenlimit)', () => {
    const state = decide(agendaGame(['quota', 'audit']), 'for');
    expect(state.config.rules.actionCardHandLimit).toBe(5);
  });

  it('RR 1.4: der gewählte Spieler besitzt das Gesetz und hat später mehr Stimmen', () => {
    const state = decide(agendaGame(['seat', 'stimulus']), GREEN);
    expect(state.laws[0]?.owner).toBe(GREEN);
    expect(votingPower(state, GREEN, content).bonus).toBe(2);
    const { events } = step(run(state, [abstain(BLUE)]), vote(GREEN, 'for', []));
    expect(events[0]).toMatchObject({ type: 'VotesCast', votes: 2 });
  });

  it('RR 1.4: ein Gesetz kann seinem Besitzer Siegpunkte oder ein höheres Rohstofflimit geben', () => {
    const chancellor = decide(agendaGame(['chancellor', 'guild']), BLUE);
    expect(playerOf(chancellor, BLUE).victoryPoints).toBe(1);
    const guild = decide(chancellor, GREEN);
    expect(playerOf(guild, GREEN).commodityLimit).toBe(5);
  });

  it('RR 1.5: aufgehobene Gesetze wirken nicht mehr und kommen auf die Ablage', () => {
    const enacted = decide(agendaGame(['chancellor', 'reform']), BLUE);
    const state = decide(enacted, 'for');
    expect(state.laws).toEqual([]);
    expect(playerOf(state, BLUE).victoryPoints).toBe(0);
    expect(state.agendaDeck.discard).toEqual([AG('reform'), AG('chancellor')]);
  });
});

describe('Wirkungen der Direktiven', () => {
  it('Wahl eines Spielers: Siegpunkt, Aktionskarten, geheimer Auftrag', () => {
    const medal = decide(agendaGame(['medal', 'leak']), GREEN);
    expect(playerOf(medal, GREEN).victoryPoints).toBe(1);
    const leak = decide(medal, RED);
    expect(playerOf(leak, RED).actionCards).toHaveLength(
      playerOf(medal, RED).actionCards.length + 2,
    );
    const before = agendaGame(['mandate']);
    const mandate = decide(before, BLUE);
    expect(playerOf(mandate, BLUE).secretObjectives).toHaveLength(
      playerOf(before, BLUE).secretObjectives.length + 1,
    );
  });

  it('Marker: alle erhalten einen Taktikmarker, bei Dagegen verlieren Befürworter Flottenmarker', () => {
    const before = agendaGame(['mobilize']);
    const gained = decide(before, 'for');
    expect(playerOf(gained, RED).commandPools.tactic).toBe(
      playerOf(before, RED).commandPools.tactic + 1,
    );
    const lost = run(agendaGame(['mobilize']), [
      vote(BLUE, 'against'),
      vote(GREEN, 'for', [prime(GREEN)]),
      vote(RED, 'against'),
    ]);
    expect(playerOf(lost, GREEN).commandPools.fleet).toBe(
      playerOf(before, GREEN).commandPools.fleet - 1,
    );
  });

  it('Planeten mit Merkmal werden erschöpft', () => {
    const state = decide(
      agendaGame(['blackout', 'stimulus'], (s) => withController(s, ALPHA, GREEN)),
      'for',
    );
    expect(state.planets[ALPHA]?.exhausted).toBe(true);
  });

  it('Planetenwahl: Infanterie auf den Planeten, Gebäude zerstören', () => {
    const survey = decide(
      agendaGame(['survey'], (s) => withController(s, ALPHA, BLUE)),
      ALPHA,
    );
    expect(survey.planets[ALPHA]?.units.filter((u) => u.owner === BLUE)).toHaveLength(2);
    const cleanup = decide(agendaGame(['cleanup']), prime(GREEN));
    expect(cleanup.planets[prime(GREEN)]?.units.some((u) => u.type === T.dock)).toBe(false);
  });

  it('Aktionskarten: alle ziehen oder werfen zufällig ab; das Tribunal nimmt alle', () => {
    const start = agendaGame(['amnesty', 'amnesty']);
    const hands = (state: GameState) => state.players.map((player) => player.actionCards.length);
    const drawn = decide(start, 'for');
    expect(hands(drawn)).toEqual(hands(start).map((count) => count + 1));
    const discarded = decide(drawn, 'against');
    expect(hands(discarded)).toEqual(hands(start));
    const accused = agendaGame(['tribunal'], (s) =>
      updatePlayer(s, RED, (p) => ({ ...p, actionCards: [AC('goods'), AC('dock')] })),
    );
    const tribunal = decide(accused, RED);
    expect(playerOf(tribunal, RED).actionCards).toEqual([]);
    expect(tribunal.actionDeck.discard).toHaveLength(playerOf(accused, RED).actionCards.length);
  });

  it('Wehrpflicht und Reparatur', () => {
    const start = agendaGame(['conscript', 'review']);
    const home = (state: GameState) =>
      state.planets[prime(GREEN)]?.units.filter((u) => u.type === T.infantry).length ?? 0;
    const conscripted = decide(start, GREEN);
    expect(home(conscripted)).toBe(home(start) + 3);
    const damaged = {
      ...conscripted,
      systems: Object.fromEntries(
        Object.entries(conscripted.systems).map(([id, system]) => [
          id,
          { ...system, spaceUnits: system.spaceUnits.map((u) => ({ ...u, damaged: true })) },
        ]),
      ),
    };
    const repaired = decide(damaged, 'for');
    const ships = Object.values(repaired.systems).flatMap((system) => system.spaceUnits);
    expect(ships.every((ship) => !ship.damaged)).toBe(true);
  });

  it('RR 68.7: ein Siegpunkt aus der Agendaphase kann die Partie entscheiden', () => {
    const close = agendaGame(['medal'], (s) =>
      updatePlayer(s, GREEN, (p) => ({ ...p, victoryPoints: s.config.victoryPointsToWin - 1 })),
    );
    const { state, events } = step(run(close, [vote(BLUE, GREEN), abstain(GREEN)]), abstain(RED));
    expect(types(events).at(-1)).toBe('GameWon');
    expect(state.winner).toBe(GREEN);
  });
});

describe('Agendabefehle außerhalb der Agendaphase', () => {
  it('Abstimmen geht nur in der Agendaphase', () => {
    const state = actionPhaseGame();
    expect(codeOf(state, vote(RED, 'for'))).toBe('phase.commandNotAllowed');
    expect(agendaActor(state)).toBeNull();
    expect(currentAgenda(state, content)).toBeNull();
  });

  it('Infanterie ohne Heimatplanet kommt nirgends hin', () => {
    const state = agendaGame(['conscript'], (s) => withController(s, prime(GREEN), BLUE));
    const after = decide(state, GREEN);
    expect(after.planets[prime(GREEN)]?.units.filter((u) => u.owner === GREEN)).toHaveLength(
      state.planets[prime(GREEN)]?.units.filter((u) => u.owner === GREEN).length ?? 0,
    );
    expect(unit(T.infantry).owner).toBe(RED);
  });
});

describe('Agendawirkungen ohne Ziel bleiben aus', () => {
  const input = (state: GameState, effect: AgendaEffect, player: PlayerId = RED) => ({
    state,
    player,
    effect,
    planet: null,
    context: contextWith(),
  });
  const none = (state: GameState, effect: AgendaEffect, player?: PlayerId) =>
    agendaEffectEvents(input(state, effect, player));

  it('nichts zu verlieren, nichts aufzufüllen, keine Marker im Vorrat', () => {
    const state = updatePlayer(actionPhaseGame(), RED, (p) => ({
      ...p,
      tradeGoods: 0,
      commodities: p.commodityLimit,
      reinforcementTokens: 0,
      commandPools: { ...p.commandPools, fleet: 0 },
    }));
    expect(none(state, { kind: 'loseTradeGoods', amount: 2 })).toEqual([]);
    expect(none(state, { kind: 'replenishCommodities' })).toEqual([]);
    expect(none(state, { kind: 'gainCommandTokens', pool: 'tactic', amount: 1 })).toEqual([]);
    expect(none(state, { kind: 'loseCommandTokens', pool: 'fleet', amount: 1 })).toEqual([]);
    expect(none(state, { kind: 'discardActionCards', count: 1 })).toEqual([]);
    expect(none(state, { kind: 'exhaustPlanets', trait: 'hazardous' })).toEqual([]);
    expect(none(state, { kind: 'repealLaws' })).toEqual([]);
  });

  it('ohne gewählten Planeten keine Infanterie und keine Zerstörung', () => {
    const state = actionPhaseGame();
    const place = { kind: 'placeUnits', unit: T.infantry, count: 1, where: 'electedPlanet' };
    expect(none(state, place as AgendaEffect)).toEqual([]);
    expect(none(state, { kind: 'destroyStructures' })).toEqual([]);
  });

  it('unbekannte Spieler haben nichts', () => {
    const state = actionPhaseGame();
    const ghost = 'geist' as PlayerId;
    expect(none(state, { kind: 'loseTradeGoods', amount: 1 }, ghost)).toEqual([]);
    expect(none(state, { kind: 'replenishCommodities' }, ghost)).toEqual([]);
    expect(none(state, { kind: 'loseCommandTokens', pool: 'tactic', amount: 1 }, ghost)).toEqual(
      [],
    );
  });

  it('Reducer: Gesetze ohne Besitzer und Abstimmungs-Events ohne laufende Agenda', () => {
    const state = actionPhaseGame();
    const law = { agenda: AG('chancellor'), owner: null, planet: null };
    const after = [
      { type: 'LawEnacted', law: { ...law, effect: { kind: 'ownerVictoryPoints', amount: 1 } } },
      { type: 'LawEnacted', law: { ...law, effect: { kind: 'ownerCommodityLimit', amount: 1 } } },
      { type: 'PlayerAbstained', player: RED },
      { type: 'AgendaTied', outcomes: [] },
    ].reduce((current, event) => evolveGame(current, event as GameEvent), state);
    expect(after.players).toEqual(state.players);
    expect(after.agendaPhase).toBeNull();
    expect(lawVotes(after, RED)).toBe(0);
  });
});
