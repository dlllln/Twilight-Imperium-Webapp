import { describe, expect, it } from 'vitest';
import {
  type ActionTarget,
  decideGameCommand,
  drawEvents,
  evolveGame,
  excessActionCards,
  type GameState,
  handCards,
  homeSystemIdOf,
  type PlayerId,
  planetId,
  reactionActor,
  reactionOrder,
  updatePlayer,
  usableCards,
} from '../src/index.ts';
import { activate, board, moves, order, planetOf, S } from './board.ts';
import { AC, BLUE, content, contextWith, RED, ScriptedRandom, T, unit, units } from './fixtures.ts';
import { actionPhaseGame, GREEN, run, step } from './game-flow.ts';

const withHand = (state: GameState, player: PlayerId, ...cards: string[]): GameState =>
  updatePlayer(state, player, (p) => ({ ...p, actionCards: cards.map(AC) }));

const play = (issuedBy: PlayerId, card: string, target: ActionTarget = {}) =>
  ({ type: 'PlayActionCard', issuedBy, card: AC(card), target }) as const;

const pass = (issuedBy: PlayerId) => ({ type: 'PassReaction', issuedBy }) as const;

const codeOf = (state: GameState, command: Parameters<typeof decideGameCommand>[1]) => {
  const result = decideGameCommand(state, command, contextWith());
  return result.ok ? 'ok' : result.error.code;
};

const types = (events: readonly { type: string }[]) => events.map((event) => event.type);
const playerOf = (state: GameState, id: PlayerId) => state.players.find((p) => p.id === id);

describe('Aktionskarten ziehen und Handkartenlimit (RR 3.3, RR 3.4)', () => {
  it('RR 3.3: die obersten Karten kommen auf die Hand', () => {
    const state = actionPhaseGame();
    const top = state.actionDeck.deck.slice(0, 2);
    const drawn = drawEvents(state, RED, 2, new ScriptedRandom([0]));
    expect(drawn).toEqual([{ type: 'ActionCardsDrawn', player: RED, cards: top }]);
  });

  it('RR 3.3: ist der Stapel leer, wird die Ablage gemischt und weitergezogen', () => {
    const state = {
      ...actionPhaseGame(),
      actionDeck: { deck: [AC('goods')], discard: [AC('dock'), AC('ready')] },
    };
    const drawn = drawEvents(state, RED, 2, new ScriptedRandom([0]));
    expect(types(drawn)).toEqual(['ActionDeckReshuffled', 'ActionCardsDrawn']);
    const after = drawn.reduce(evolveGame, state);
    expect(playerOf(after, RED)?.actionCards).toHaveLength(2);
    expect(after.actionDeck.deck).toHaveLength(1);
    expect(after.actionDeck.discard).toEqual([]);
  });

  it('RR 3.4: über dem Limit legt der Spieler genau die überzähligen Karten ab', () => {
    const full = withHand(actionPhaseGame(), BLUE, ...Array.from({ length: 8 }, () => 'goods'));
    const discard = (cards: readonly string[]) =>
      ({ type: 'DiscardActionCards', issuedBy: BLUE, cards: cards.map(AC) }) as const;
    expect(codeOf(full, discard(['goods', 'goods']))).toBe('actionCard.discardCount');
    expect(codeOf(full, discard(['dock']))).toBe('actionCard.notInHand');
    expect(codeOf(actionPhaseGame(), discard(['goods']))).toBe('actionCard.noDiscard');
    const { state } = step(full, discard(['goods']));
    expect(playerOf(state, BLUE)?.actionCards).toHaveLength(7);
    expect(state.actionDeck.discard).toEqual([AC('goods')]);
  });
});

describe('Materialaktionen (RR 51)', () => {
  it('RR 51: die Karte wirkt, kommt auf den Ablagestapel und beendet den Zug', () => {
    const state = withHand(actionPhaseGame(), RED, 'goods');
    const { state: after, events } = step(state, play(RED, 'goods'));
    expect(types(events)).toEqual([
      'ActionCardPlayed',
      'ActionCardResolved',
      'TradeGoodsGained',
      'TurnEnded',
    ]);
    expect(playerOf(after, RED)).toMatchObject({ tradeGoods: 2, actionCards: [] });
    expect(after.actionDeck.discard).toEqual([AC('goods')]);
    expect(after.actionPhase?.active).toBe(BLUE);
  });

  it('RR 3.6/51.3: nur im eigenen Zug, nur von der Hand, nur mit möglicher Wirkung', () => {
    const state = withHand(withHand(actionPhaseGame(), RED, 'goods', 'ready'), BLUE, 'goods');
    expect(codeOf(state, play(BLUE, 'goods'))).toBe('actionCard.wrongTiming');
    expect(codeOf(state, play(RED, 'dock'))).toBe('actionCard.notInHand');
    expect(codeOf(state, play(RED, 'ready'))).toBe('actionCard.notUsable');
    expect(codeOf(state, play(RED, 'nope'))).toBe('actionCard.unknown');
  });

  it('Kommandoreserve: 1 Marker in den gewählten Pool', () => {
    const state = withHand(actionPhaseGame(), RED, 'reserve');
    expect(codeOf(state, play(RED, 'reserve'))).toBe('actionCard.invalidTarget');
    const after = step(state, play(RED, 'reserve', { pool: 'fleet' })).state;
    expect(playerOf(after, RED)?.commandPools.fleet).toBe(
      (playerOf(state, RED)?.commandPools.fleet ?? 0) + 1,
    );
    const empty = updatePlayer(state, RED, (p) => ({ ...p, reinforcementTokens: 0 }));
    expect(codeOf(empty, play(RED, 'reserve', { pool: 'fleet' }))).toBe('actionCard.notUsable');
  });

  it('Reaktivierung: erschöpfte eigene Planeten werden bereit', () => {
    const base = actionPhaseGame();
    const home = planetId('red-prime');
    const tired = {
      ...base,
      planets: { ...base.planets, [home]: { ...base.planets[home], exhausted: true } },
    } as GameState;
    const state = withHand(tired, RED, 'ready');
    expect(codeOf(state, play(RED, 'ready', { planets: [home, home] }))).toBe(
      'actionCard.invalidTarget',
    );
    const after = step(state, play(RED, 'ready', { planets: [home] })).state;
    expect(after.planets[home]?.exhausted).toBe(false);
  });

  it('Rekrutierung: 2 Infanterie auf einen Planeten im Heimatsystem', () => {
    const state = withHand(actionPhaseGame(), RED, 'recruit');
    const home = planetId('red-prime');
    expect(homeSystemIdOf(state, RED, content)).toBeDefined();
    const before = state.planets[home]?.units.length ?? 0;
    const after = step(state, play(RED, 'recruit', { planets: [home] })).state;
    expect(after.planets[home]?.units).toHaveLength(before + 2);
    expect(codeOf(state, play(RED, 'recruit', { planets: [planetId('blue-prime')] }))).toBe(
      'actionCard.invalidTarget',
    );
  });

  it('Rückruf: ein eigener Marker kommt vom Spielplan in den Taktikpool', () => {
    const state = withHand(board({ id: 'a', q: 0, tokens: [RED] }), RED, 'recall');
    const tactic = playerOf(state, RED)?.commandPools.tactic ?? 0;
    expect(codeOf(state, play(RED, 'recall', { system: S('x') }))).toBe('actionCard.invalidTarget');
    const after = step(state, play(RED, 'recall', { system: S('a') })).state;
    expect(after.systems.a?.commandTokens).toEqual([]);
    expect(playerOf(after, RED)?.commandPools.tactic).toBe(tactic + 1);
  });

  it('Geheimdienst und Nachschubkonvoi: Karten ziehen, Rohstoffe auffüllen', () => {
    const state = withHand(actionPhaseGame(), RED, 'intel');
    const after = step(state, play(RED, 'intel')).state;
    expect(playerOf(after, RED)?.actionCards).toHaveLength(2);
    const convoy = withHand(actionPhaseGame(), RED, 'convoy');
    expect(playerOf(step(convoy, play(RED, 'convoy')).state, RED)?.commodities).toBe(3);
    const full = updatePlayer(convoy, RED, (p) => ({ ...p, commodities: 3 }));
    expect(codeOf(full, play(RED, 'convoy'))).toBe('actionCard.notUsable');
  });

  it('Aufruhr: ein fremder Planet außerhalb der Heimat wird erschöpft', () => {
    const state = withHand(
      board({ id: 'a', q: 0, planet: [], planetController: BLUE }),
      RED,
      'unrest',
    );
    const target = planetOf({ id: 'a', q: 0 });
    expect(codeOf(state, play(RED, 'unrest', { planets: [planetId('red-prime')] }))).toBe(
      'actionCard.invalidTarget',
    );
    const after = step(state, play(RED, 'unrest', { planets: [target] })).state;
    expect(after.planets[target]?.exhausted).toBe(true);
  });

  it('Kaperbrief und Handelsmission wirken nur unter Nachbarn (RR 55)', () => {
    const shared = board({ id: 'a', q: 0, units: [unit(T.cruiser), unit(T.cruiser, BLUE)] });
    const rich = updatePlayer(shared, BLUE, (p) => ({ ...p, tradeGoods: 3 }));
    const state = withHand(rich, RED, 'marque', 'mission');
    expect(codeOf(state, play(RED, 'marque', { player: GREEN }))).toBe('actionCard.invalidTarget');
    const after = step(state, play(RED, 'marque', { player: BLUE })).state;
    expect([playerOf(after, RED)?.tradeGoods, playerOf(after, BLUE)?.tradeGoods]).toEqual([2, 1]);
    const lonely = withHand(board({ id: 'a', q: 0, units: [unit(T.cruiser)] }), RED, 'mission');
    expect(codeOf(lonely, play(RED, 'mission'))).toBe('actionCard.notUsable');
    expect(playerOf(step(state, play(RED, 'mission')).state, RED)?.tradeGoods).toBe(1);
  });

  it('Sabotagetrupp und Werftschicht: fremde Bodentruppe zerstören, eigene Einheiten reparieren', () => {
    const defender = unit(T.infantry, BLUE);
    const damaged = unit(T.cruiser, RED, true);
    const state = withHand(
      board({ id: 'a', q: 0, units: [damaged], planet: [defender], planetController: BLUE }),
      RED,
      'raid',
      'dock',
    );
    const after = step(state, play(RED, 'raid', { planets: [planetOf({ id: 'a', q: 0 })] }));
    expect(after.state.planets[planetOf({ id: 'a', q: 0 })]?.units).toEqual([]);
    const repaired = step(state, play(RED, 'dock')).state;
    expect(repaired.systems.a?.spaceUnits[0]?.damaged).toBe(false);
    const healthy = withHand(board({ id: 'a', q: 0, units: [unit(T.cruiser)] }), RED, 'dock');
    expect(codeOf(healthy, play(RED, 'dock'))).toBe('actionCard.notUsable');
  });
});

describe('Verhindern (RR 3.8, RR 51.4)', () => {
  const contested = () => withHand(withHand(actionPhaseGame(), RED, 'goods'), BLUE, 'counter');

  it('RR 3.8: Wer verhindern könnte, wird gefragt; bis dahin ruht alles andere', () => {
    const { state, events } = step(contested(), play(RED, 'goods'));
    expect(types(events)).toEqual(['ActionCardPlayed']);
    expect(state.pendingPlay).toMatchObject({ player: RED, awaiting: [BLUE] });
    expect(reactionActor(state)).toBe(BLUE);
    expect(codeOf(state, { type: 'Pass', issuedBy: RED })).toBe('reaction.open');
    expect(codeOf(state, pass(RED))).toBe('reaction.notYourTurn');
  });

  it('RR 3.8/51.4: eine verhinderte Materialaktion wirkt nicht und kostet keinen Zug', () => {
    const played = step(contested(), play(RED, 'goods')).state;
    const { state, events } = step(played, play(BLUE, 'counter'));
    expect(types(events)).toEqual(['ActionCardCancelled']);
    expect(playerOf(state, RED)?.tradeGoods).toBe(0);
    expect(state.actionDeck.discard).toEqual([AC('goods'), AC('counter')]);
    expect(state.actionPhase?.active).toBe(RED);
    expect(state.pendingPlay).toBeNull();
  });

  it('wer nicht verhindert, lässt die Karte wirken', () => {
    const played = step(contested(), play(RED, 'goods')).state;
    const { state, events } = step(played, pass(BLUE));
    expect(types(events)).toEqual([
      'CancelDeclined',
      'ActionCardResolved',
      'TradeGoodsGained',
      'TurnEnded',
    ]);
    expect(playerOf(state, RED)?.tradeGoods).toBe(2);
  });

  it('mehrere Verhinderer reihum: erst wenn alle verzichten, wirkt die Karte', () => {
    const state = withHand(contested(), GREEN, 'counter');
    const played = step(state, play(RED, 'goods')).state;
    expect(played.pendingPlay?.awaiting).toEqual([BLUE, GREEN]);
    const { state: after, events } = step(played, pass(BLUE));
    expect(types(events)).toEqual(['CancelDeclined']);
    expect(reactionActor(after)).toBe(GREEN);
  });
});

describe('Zeitfenster der Taktikaktion (RR 3.10)', () => {
  it('nach der Aktivierung: Mobilmachung setzt Infanterie, dann geht es weiter', () => {
    const planet = planetOf({ id: 'b', q: 1 });
    const state = withHand(
      board({ id: 'a', q: 0 }, { id: 'b', q: 1, planet: [], planetController: BLUE }),
      BLUE,
      'mobilize',
    );
    const { state: opened, events } = step(state, activate('b'));
    expect(events.at(-1)).toMatchObject({
      type: 'ReactionWindowOpened',
      kind: 'afterActivation',
      awaiting: [BLUE],
    });
    expect(codeOf(opened, moves())).toBe('reaction.open');
    const placed = step(opened, play(BLUE, 'mobilize', { planets: [planet] })).state;
    expect(placed.planets[planet]?.units).toHaveLength(1);
    expect(reactionActor(placed)).toBe(BLUE);
    const closed = step(placed, pass(BLUE)).state;
    expect(closed.reactionWindow).toBeNull();
    expect(closed.actionPhase?.tactical?.windows).toEqual(['afterActivation']);
  });

  it('ohne passende Karte öffnet kein Fenster; der Aktive selbst darf nicht mobilisieren', () => {
    const state = withHand(
      board({ id: 'a', q: 0 }, { id: 'b', q: 1, planet: [] }),
      RED,
      'mobilize',
    );
    const { state: after } = step(state, activate('b'));
    expect(after.reactionWindow).toBeNull();
  });

  it('Raumkampfrunde: Gefechtsdrill gibt +1 auf die Kampfwürfe dieser Runde', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    // Grün kämpft nicht mit und wird deshalb nicht gefragt.
    const state = withHand(
      withHand(
        board({ id: 'a', q: 0, units: [red] }, { id: 'b', q: 1, units: [blue] }),
        RED,
        'drill',
        'drill',
      ),
      GREEN,
      'drill',
    );
    const six = contextWith(new ScriptedRandom([6]));
    const activated = run(state, [activate('b')], six);
    const opened = step(activated, moves(order(red, ['b'])), six).state;
    expect(opened.reactionWindow).toMatchObject({ kind: 'combatRound', awaiting: [RED] });
    const drilled = step(opened, play(RED, 'drill'), six).state;
    expect(codeOf(drilled, play(RED, 'drill'))).toBe('actionCard.sameName');
    const { events } = step(drilled, pass(RED), six);
    const rolled = events.find((event) => event.type === 'CombatRoundRolled');
    expect(rolled).toMatchObject({ volleys: [{ hits: 1 }, { hits: 0 }] });
  });

  it('nach Treffern: Ausweichmanöver wendet einen Treffer ab, statt automatisch zuzuweisen', () => {
    const red = unit(T.cruiser);
    const blue = unit(T.cruiser, BLUE);
    const state = withHand(
      board({ id: 'a', q: 0, units: [red] }, { id: 'b', q: 1, units: [blue] }),
      BLUE,
      'evade',
    );
    const hit = contextWith(new ScriptedRandom([10]));
    const activated = run(state, [activate('b')], hit);
    const after = step(activated, moves(order(red, ['b'])), hit).state;
    expect(after.actionPhase?.tactical?.pendingHits).toEqual([{ player: BLUE, hits: 1 }]);
    const { state: saved, events } = step(after, play(BLUE, 'evade'), hit);
    expect(events).toContainEqual({ type: 'HitsCancelled', player: BLUE, amount: 1 });
    expect(saved.systems.b?.spaceUnits.some((u) => u.id === blue.id)).toBe(true);
  });

  it('Einmarsch: Verschanzung und Landungsdrill verbessern den Bodenkampf', () => {
    const carrier = unit(T.carrier);
    const attackers = units(1, T.infantry);
    const defenders = units(1, T.infantry, BLUE);
    const state = withHand(
      withHand(
        board(
          { id: 'a', q: 0, units: [carrier, ...attackers] },
          { id: 'b', q: 1, planet: defenders, planetController: BLUE },
        ),
        RED,
        'landing',
      ),
      BLUE,
      'entrench',
    );
    const seven = contextWith(new ScriptedRandom([7]));
    const activated = run(state, [activate('b')], seven);
    const opened = step(activated, moves(order(carrier, ['b'], attackers)), seven).state;
    expect(opened.reactionWindow).toMatchObject({ kind: 'invasion', awaiting: [RED, BLUE] });
    const boosted = run(
      opened,
      [play(RED, 'landing'), pass(RED), play(BLUE, 'entrench'), pass(BLUE)],
      seven,
    );
    expect(boosted.actionPhase?.tactical?.bonuses).toHaveLength(2);
    const landing = {
      type: 'CommitGroundForces',
      issuedBy: RED,
      landings: [{ unit: attackers[0]?.id as never, planet: planetOf({ id: 'b', q: 1 }) }],
      centerPayment: null,
    } as const;
    const { events } = step(boosted, landing, seven);
    expect(events.find((event) => event.type === 'GroundCombatRoundRolled')).toMatchObject({
      volleys: [{ hits: 1 }, { hits: 1 }],
    });
  });
});

describe('Sekundärfähigkeit ohne Strategiemarker (RR 46.5)', () => {
  it('Trittbrettfahrer: der Spieler zahlt keinen Strategiemarker', () => {
    const state = withHand(actionPhaseGame(), BLUE, 'rider');
    const acted = run(state, [
      {
        type: 'PerformStrategicAction',
        issuedBy: RED,
        card: 'card-1' as never,
        choice: {
          mechanic: 'commandTokens',
          influence: { planets: [], tradeGoods: 0 },
          allocation: { tactic: 3, fleet: 0, strategy: 0 },
        },
      },
    ]);
    expect(handCards(acted, BLUE, content)[0]?.playable).toBe(true);
    const after = step(acted, play(BLUE, 'rider')).state;
    expect(after.actionPhase?.secondary?.free).toContain(BLUE);
    expect(handCards(after, BLUE, content)).toEqual([]);
  });
});

describe('Hand für Clients', () => {
  it('fasst gleichnamige Karten zusammen und nennt Spielbarkeit und Ziele', () => {
    const state = withHand(actionPhaseGame(), RED, 'goods', 'goods', 'reserve', 'counter');
    const hand = handCards(state, RED, content);
    expect(hand.map((card) => [card.definition.id, card.count, card.playable])).toEqual([
      [AC('goods'), 2, true],
      [AC('reserve'), 1, true],
      [AC('counter'), 1, false],
    ]);
    expect(hand[1]?.targets).toEqual({ pool: true });
    expect(reactionActor(state)).toBeNull();
  });
});

describe('Randfälle für Clients und Zeitpunkte', () => {
  it('unbekannte Karten auf der Hand werden übergangen; das offene Fenster bestimmt den Akteur', () => {
    const state = withHand(actionPhaseGame(), RED, 'ghost', 'goods');
    expect(handCards(state, RED, content).map((card) => card.definition.id)).toEqual([AC('goods')]);
    const window = {
      ...state,
      reactionWindow: { kind: 'invasion' as const, awaiting: [BLUE], played: [] },
    };
    expect(reactionActor(window)).toBe(BLUE);
    expect(handCards(window, RED, content)[0]?.playable).toBe(false);
  });

  it('wer die Sekundärfähigkeit schon frei hat, braucht keinen Trittbrettfahrer', () => {
    const state = withHand(actionPhaseGame(), BLUE, 'rider');
    const free = {
      ...state,
      actionPhase: state.actionPhase && {
        ...state.actionPhase,
        secondary: { card: 'card-1' as never, awaiting: [BLUE], free: [BLUE] },
      },
    };
    expect(codeOf(free, play(BLUE, 'rider'))).toBe('actionCard.wrongTiming');
  });

  it('Treffer abwenden nur, wenn Treffer gegen den Spieler offen sind', () => {
    const state = withHand(actionPhaseGame(), RED, 'evade');
    expect(codeOf(state, play(RED, 'evade'))).toBe('actionCard.wrongTiming');
  });

  it('PassReaction ohne offenes Fenster und Verhindern ohne offene Karte sind Fehler', () => {
    const state = withHand(actionPhaseGame(), RED, 'counter');
    expect(codeOf(state, pass(RED))).toBe('reaction.notYourTurn');
    expect(codeOf(state, play(RED, 'counter'))).toBe('actionCard.wrongTiming');
  });
});

describe('Reaktionen außerhalb ihres Anlasses', () => {
  it('ohne Taktikaktion, Kampf oder Treffer ist keine Reaktion möglich', () => {
    const state = withHand(
      withHand(actionPhaseGame(), RED, 'drill', 'landing', 'evade'),
      BLUE,
      'entrench',
    );
    expect(usableCards(state, RED, 'combatRound', content)).toEqual([]);
    expect(usableCards(state, RED, 'invasion', content)).toEqual([]);
    expect(usableCards(state, RED, 'afterHits', content)).toEqual([]);
    expect(usableCards(state, BLUE, 'invasion', content)).toEqual([]);
  });

  it('Reihenfolge ab dem aktiven Spieler, sonst nach Sitzplätzen; Unbekannte haben nichts abzulegen', () => {
    const state = actionPhaseGame();
    const blueTurn = {
      ...state,
      actionPhase: state.actionPhase && { ...state.actionPhase, active: BLUE },
    };
    expect(reactionOrder(blueTurn)).toEqual([BLUE, GREEN, RED]);
    expect(reactionOrder({ ...state, actionPhase: null })).toEqual([RED, BLUE, GREEN]);
    expect(excessActionCards(state, 'ghost' as PlayerId)).toBe(0);
  });
});
