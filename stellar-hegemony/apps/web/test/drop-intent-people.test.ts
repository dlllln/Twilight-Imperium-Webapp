import {
  type ActionCardDefinition,
  type GameState,
  type HandCard,
  type PlayerId,
  playerId,
  systemId,
  type TargetOptions,
} from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { content } from '../src/store.ts';
import { type DropInput, dropIntent } from '../src/table/use-drop-router.ts';
import {
  actionPiece,
  playerTarget,
  poolTarget,
  SOCKET,
  SPEAKER_PIECE,
  systemTarget,
} from '../src/table/target-ref.ts';
import { withSocket } from '../src/table/carry-rules.ts';
import { pickAll, started } from './game-helpers.ts';

const BLUE = playerId('blue');

const definition = (): ActionCardDefinition => {
  const card = content.actionCards[0];
  if (card === undefined) throw new Error('keine Aktionskarte');
  return card;
};

const handCard = (targets: TargetOptions, playable = true): HandCard => ({
  definition: definition(),
  count: 1,
  playable,
  targets,
});

function inputOf(game: GameState, extra: Partial<DropInput> = {}): DropInput {
  const viewer = game.actionPhase?.active as PlayerId;
  return { game, actor: viewer, choosing: false, specId: null, draft: null, viewer, ...extra };
}

describe('Karten und Sprechermarker ablegen', () => {
  it('eine Karte auf einer Leiste spielt sie mit diesem Feld aus', () => {
    const game = pickAll(started());
    const input = inputOf(game, { cards: [handCard({ pool: true })] });
    const piece = actionPiece(definition().id);
    expect(dropIntent(input, piece, poolTarget('strategy'))).toEqual({
      kind: 'send',
      command: {
        type: 'PlayActionCard',
        issuedBy: input.viewer,
        card: definition().id,
        target: { pool: 'strategy' },
      },
    });
  });

  it('eine Karte auf einem System spielt sie dort aus, auf fremden Zielen nicht', () => {
    const game = pickAll(started());
    const options = { systems: [systemId('18')] };
    const input = inputOf(game, { cards: [handCard(options)] });
    const piece = actionPiece(definition().id);
    const intent = dropIntent(input, piece, systemTarget('18'));
    expect(intent?.kind === 'send' && intent.command).toMatchObject({ target: { system: '18' } });
    expect(dropIntent(input, piece, systemTarget('19'))).toBeNull();
    expect(dropIntent(input, piece, poolTarget('tactic'))).toBeNull();
  });

  it('nicht spielbare oder fremde Karten bewirken nichts', () => {
    const game = pickAll(started());
    const piece = actionPiece(definition().id);
    const blocked = inputOf(game, { cards: [handCard({ pool: true }, false)] });
    expect(dropIntent(blocked, piece, poolTarget('fleet'))).toBeNull();
    const nobody = inputOf(game, { cards: [handCard({ pool: true })], viewer: null });
    expect(dropIntent(nobody, piece, poolTarget('fleet'))).toBeNull();
    expect(dropIntent(inputOf(game), piece, poolTarget('fleet'))).toBeNull();
  });

  it('der Sprechermarker auf einem Bild wählt den Mitspieler, ohne Tischentscheidung nicht', () => {
    const game = pickAll(started());
    const politics = inputOf(game, { specId: 'politics', draft: { kind: 'players', players: [] } });
    expect(dropIntent(politics, SPEAKER_PIECE, playerTarget(BLUE))).toEqual({
      kind: 'act',
      action: { kind: 'player', player: BLUE },
    });
    expect(dropIntent(politics, SPEAKER_PIECE, systemTarget('18'))).toBeNull();
    const idle = inputOf(game);
    expect(dropIntent(idle, SPEAKER_PIECE, playerTarget(BLUE))).toBeNull();
  });

  it('der oberste Strategiemarker im Sockel folgt der Karte, aber nur solange der Sockel ihn nimmt', () => {
    const game = pickAll(started());
    const token = poolTarget('strategy');
    expect(dropIntent(inputOf(game, { socket: true }), token, SOCKET)).toEqual({ kind: 'socket' });
    expect(dropIntent(inputOf(game), token, SOCKET)).toBeNull();
    expect(dropIntent(inputOf(game, { socket: true }), poolTarget('tactic'), SOCKET)).toBeNull();
    expect([...withSocket(new Set(), token, true)]).toEqual(['slot:socket']);
    expect(withSocket(new Set(), token, false).size).toBe(0);
    expect(withSocket(new Set(), poolTarget('fleet'), true).size).toBe(0);
  });
});
