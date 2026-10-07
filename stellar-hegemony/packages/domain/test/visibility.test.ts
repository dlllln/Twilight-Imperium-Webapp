import { describe, expect, it } from 'vitest';
import {
  type GameEvent,
  type GameState,
  HIDDEN,
  playerView,
  updatePlayer,
  visibleEvents,
} from '../src/index.ts';
import { AC, BLUE, RED } from './fixtures.ts';
import { setupGame, startedGame, step } from './game-flow.ts';

const holding = (state: GameState): GameState =>
  updatePlayer(state, BLUE, (player) => ({ ...player, actionCards: [AC('a'), AC('b')] }));

const blueIn = (state: GameState) => state.players.find((player) => player.id === BLUE);

/** Blau hält zwei geheime Aufträge, einer davon ist gewertet. */
function blueScoredOneSecret() {
  const base = startedGame();
  const options = blueIn(base)?.secretChoice?.options ?? [];
  const [kept = HIDDEN, scored = HIDDEN] = options;
  const state = updatePlayer(
    { ...base, objectives: { ...base.objectives, scored: { [scored]: [BLUE] } } },
    BLUE,
    (player) => ({ ...player, secretObjectives: [kept, scored] as never }),
  );
  return { state, options, scored };
}

const ofType = <K extends GameEvent['type']>(events: readonly GameEvent[], type: K) =>
  events.find((event): event is Extract<GameEvent, { type: K }> => event.type === type);

describe('Sichtbarkeit für Online-Partien', () => {
  it('RR 3.5: fremde Handkarten sind verdeckt, die Anzahl bleibt sichtbar', () => {
    const state = holding(startedGame());
    const blue = (viewer: typeof RED | null) =>
      playerView(state, viewer).players.find((player) => player.id === BLUE)?.actionCards;
    expect(blue(BLUE)).toEqual([AC('a'), AC('b')]);
    expect(blue(RED)).toEqual([HIDDEN, HIDDEN]);
    expect(blue(null)).toEqual([HIDDEN, HIDDEN]);
  });

  it('RR 12.17: geheime Aufträge sieht nur ihr Besitzer, gewertete sind offen', () => {
    const { state, options, scored } = blueScoredOneSecret();
    const blue = blueIn(playerView(state, RED));
    expect(blue?.secretObjectives).toEqual([HIDDEN, scored]);
    expect(blue?.secretChoice?.options.every((id) => id === HIDDEN)).toBe(true);
    expect(blueIn(playerView(state, BLUE))?.secretChoice?.options).toEqual(options);
  });

  it('RR 12.13: verdeckte öffentliche Aufträge und alle Stapel bleiben verborgen', () => {
    const view = playerView(startedGame(), RED);
    const hiddenSlots = view.objectives.public.filter((slot) => !slot.revealed);
    expect(hiddenSlots.length).toBeGreaterThan(0);
    expect(hiddenSlots.every((slot) => slot.id === HIDDEN)).toBe(true);
    expect(view.objectives.public.some((slot) => slot.revealed && slot.id !== HIDDEN)).toBe(true);
    for (const deck of [view.actionDeck.deck, view.agendaDeck.deck, view.objectives.secretDeck])
      expect(deck.every((id) => id === HIDDEN)).toBe(true);
  });

  it('RR 3.5, RR 12.17: Events verraten fremde Karten und Stapel nicht', () => {
    const { events } = step(setupGame(), { type: 'StartGame', issuedBy: RED });
    const seen = visibleEvents(events, RED);
    const dealt = seen.filter((event) => event.type === 'SecretObjectivesDealt');
    expect(dealt.find((event) => event.player === RED)?.choice.options).not.toContain(HIDDEN);
    expect(dealt.find((event) => event.player === BLUE)?.choice.options).toContain(HIDDEN);
    expect(ofType(seen, 'ActionDeckPrepared')?.deck.every((id) => id === HIDDEN)).toBe(true);
    expect(ofType(seen, 'AgendaDeckPrepared')?.deck.every((id) => id === HIDDEN)).toBe(true);
    expect(ofType(seen, 'ObjectivesPrepared')?.secretDeck.every((id) => id === HIDDEN)).toBe(true);
    expect(ofType(seen, 'GameStarted')).toEqual(ofType(events, 'GameStarted'));
  });

  it('RR 3.5: gezogene Karten und Geheimaufträge anderer bleiben verdeckt', () => {
    const drawn = [
      { type: 'ActionCardsDrawn', player: BLUE, cards: [AC('a')] },
      { type: 'ActionCardsDrawn', player: RED, cards: [AC('b')] },
      { type: 'SecretObjectiveDrawn', player: BLUE, objective: 'o', overLimit: false },
      { type: 'SecretObjectiveDrawn', player: RED, objective: 'o', overLimit: false },
      { type: 'SecretObjectivesKept', player: BLUE, kept: ['o'], secretDeck: ['x'] },
      { type: 'SecretObjectivesKept', player: RED, kept: ['o'], secretDeck: ['x'] },
      { type: 'ActionDeckReshuffled', deck: [AC('c')] },
      { type: 'AgendaDeckReshuffled', deck: ['g'] },
    ] as unknown as readonly GameEvent[];
    expect(visibleEvents(drawn, RED)).toEqual([
      { type: 'ActionCardsDrawn', player: BLUE, cards: [HIDDEN] },
      { type: 'ActionCardsDrawn', player: RED, cards: [AC('b')] },
      { type: 'SecretObjectiveDrawn', player: BLUE, objective: HIDDEN, overLimit: false },
      { type: 'SecretObjectiveDrawn', player: RED, objective: 'o', overLimit: false },
      { type: 'SecretObjectivesKept', player: BLUE, kept: [HIDDEN], secretDeck: [HIDDEN] },
      { type: 'SecretObjectivesKept', player: RED, kept: ['o'], secretDeck: [HIDDEN] },
      { type: 'ActionDeckReshuffled', deck: [HIDDEN] },
      { type: 'AgendaDeckReshuffled', deck: [HIDDEN] },
    ]);
  });
});
