import { currentActor, type GameState, type PlayerId } from '@stellar/domain';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useGameStore } from '../game-store.ts';
import { hexToPixel, type Point } from '../hex-geometry.ts';
import { blendView, type BoardView, sameView, viewFrom } from '../render/board-view.ts';
import type { SceneHex } from '../render/scene-model.ts';
import { useSettingsStore } from '../settings-store.ts';
import { useCameraStore } from './camera-store.ts';
import { easeInOut } from './viewport-tween.ts';

/** Dauer der Drehung, wenn ein anderer Mensch an den Bildschirm kommt. */
export const TURN_MS = 900;
/** Vor der Partie sieht man die Karte vom ersten Platz aus. */
const SETUP_SEAT = 1;

/** Der Mensch am Zug, sonst der erste Mensch am Tisch. */
function humanAtScreen(game: GameState, bots: readonly PlayerId[]): PlayerId | undefined {
  const human = (id: PlayerId) => !bots.includes(id);
  const actor = currentActor(game);
  if (actor !== null && human(actor)) return actor;
  return game.players.find((player) => human(player.id))?.id;
}

/**
 * Aus wessen Sicht das Brett liegt: online der eigene Platz, am Hot-Seat der Mensch am Zug;
 * zieht gerade die KI, bleibt der erste menschliche Platz vorne.
 */
export function viewerSeat(
  game: GameState | null,
  me: PlayerId | null,
  bots: readonly PlayerId[],
): number {
  if (game === null) return SETUP_SEAT;
  const id = me ?? humanAtScreen(game, bots);
  const seat = game.players.find((player) => player.id === id)?.seat;
  // Im Spielzustand zählen Plätze ab 0, auf der Karte ab 1.
  return seat === undefined ? SETUP_SEAT : seat + 1;
}

/** Lage des Heimatsystems (oder Heimatplatzes) eines Platzes auf der Karte. */
export function homeOf(hexes: readonly SceneHex[], seat: number): Point | null {
  const home = hexes.find((hex) => hex.seat === seat);
  return home === undefined ? null : hexToPixel(home.position);
}

function useTargetView(hexes: readonly SceneHex[]) {
  const game = useGameStore((state) => state.game);
  const me = useGameStore((state) => state.me);
  const bots = useGameStore((state) => state.bots);
  const seat = viewerSeat(game, me, bots);
  const target = useMemo(() => viewFrom(homeOf(hexes, seat)), [hexes, seat]);
  return { target, playing: game !== null };
}

/**
 * Gedreht wird nur beim Platzwechsel in der laufenden Partie; zu Beginn liegt das Brett gleich
 * richtig. Liefert eine Abfrage, die bei jedem neuen Ziel einmal gestellt wird.
 */
function useTurning(playing: boolean): () => boolean {
  const now = useRef(playing);
  const before = useRef(playing);
  useEffect(() => {
    now.current = playing;
  }, [playing]);
  return useCallback(() => {
    const turning = before.current && now.current && useSettingsStore.getState().animations;
    before.current = now.current;
    return turning;
  }, []);
}

/** Dreht das Brett weich zum neuen Blick; die Kamera fährt dabei zurück auf die ganze Karte. */
function turnBoard(from: BoardView, to: BoardView, apply: (view: BoardView) => void) {
  const start = performance.now();
  let frame = 0;
  const step = (now: number) => {
    const t = Math.min(1, (now - start) / TURN_MS);
    apply(blendView(from, to, easeInOut(t)));
    if (t < 1) frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
  return () => cancelAnimationFrame(frame);
}

export interface BoardLook {
  /** Blick in diesem Moment (dreht sich beim Platzwechsel weich). */
  readonly view: BoardView;
  /** Blick, zu dem sich das Brett dreht; danach richtet sich der Bildausschnitt. */
  readonly target: BoardView;
}

/** Blick auf das Brett, immer vom Heimatsystem des Menschen am Bildschirm aus. */
export function useBoardView(hexes: readonly SceneHex[]): BoardLook {
  const { target, playing } = useTargetView(hexes);
  const [view, setView] = useState(target);
  const current = useRef(view);
  current.current = view;
  const turning = useTurning(playing);
  useEffect(() => {
    const animate = turning();
    if (sameView(current.current, target)) return;
    if (!animate) {
      setView(target);
      return;
    }
    useCameraStore.getState().back();
    return turnBoard(current.current, target, setView);
  }, [target, turning]);
  return { view, target };
}
