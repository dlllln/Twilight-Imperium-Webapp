import type { GameState } from '@stellar/domain';
import { motion, useReducedMotion } from 'motion/react';
import { type ReactElement, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { playTableCue } from '../../audio/table-cues.ts';
import { useGameStore, useViewer } from '../../game-store.ts';
import { useSettingsStore } from '../../settings-store.ts';
import {
  type DeckFlight,
  deckFlights,
  FLIGHT_SOURCES,
  FLIGHT_TARGETS,
  firstVisible,
  type Point,
} from '../../table/deck-flights.ts';
import { tabletopMovements } from '../tabletop/tabletop-model.ts';
import './deck-flights.css';

/*
 * Karten fliegen vom Stapel im Vorrat in die eigene Hand (bzw. geheime Aufträge auf die
 * Auftragsleiste). Die Flüge sind reine Darstellung über allem, ohne Zeiger und für Hilfsmittel
 * unsichtbar: Was gezogen wurde, sagt die Ablage des Vorrats an. Ohne Animationen fliegt nichts,
 * der leise Klang „Karte ziehen“ begleitet die Ziehung trotzdem.
 */

interface Flight extends DeckFlight {
  readonly id: string;
  readonly from: Point;
  readonly to: Point;
}

/** Misst Start und Ziel jetzt; fehlt eines, fliegt die Karte nicht. */
function placed(flight: DeckFlight, id: string): Flight | null {
  const from = firstVisible(FLIGHT_SOURCES[flight.item]);
  const to = firstVisible(FLIGHT_TARGETS[flight.item]);
  return from === null || to === null ? null : { ...flight, id, from, to };
}

/** Neue eigene Ziehungen eines Zugs, jede genau einmal; ein Wiederverbinden spielt nichts nach. */
function useDrawn(game: GameState): readonly DeckFlight[] {
  const last = useGameStore((state) => state.lastEvents);
  const viewer = useViewer();
  const seen = useRef(last?.serial ?? 0);
  const [drawn, setDrawn] = useState<readonly DeckFlight[]>([]);
  useEffect(() => {
    if (last === null || last.serial <= seen.current) return;
    seen.current = last.serial;
    setDrawn(deckFlights(tabletopMovements(last.events, { game, viewer }), viewer));
  }, [game, last, viewer]);
  return drawn;
}

/** Klang je Ziehung; Flüge nur mit Animationen und ohne Wunsch nach weniger Bewegung. */
function useFlights(game: GameState) {
  const drawn = useDrawn(game);
  const animations = useSettingsStore((state) => state.animations);
  const reduced = useReducedMotion() === true;
  const [flights, setFlights] = useState<readonly Flight[]>([]);
  useEffect(() => {
    if (drawn.length === 0) return;
    drawn.forEach(() => playTableCue('draw'));
    if (!animations || reduced) return;
    const stamp = String(Date.now());
    const next = drawn.flatMap(
      (flight, index) => placed(flight, `${stamp}-${String(index)}`) ?? [],
    );
    setFlights((before) => [...before, ...next]);
  }, [drawn, animations, reduced]);
  const land = (id: string) => setFlights((before) => before.filter((flight) => flight.id !== id));
  return { flights, land };
}

/** Eine fliegende Karte: eigene Rückseite, leicht gedreht, mit kleinem Versatz je Karte. */
function FlyingCard(props: {
  readonly flight: Flight;
  readonly index: number;
  readonly onLand?: () => void;
}) {
  const { flight, index } = props;
  const delay = index * 0.12;
  return (
    <motion.i
      className="deck-flight-card"
      data-item={flight.item}
      style={{ left: flight.from.x, top: flight.from.y }}
      initial={{ x: 0, y: 0, rotate: -8, scale: 0.8, opacity: 0 }}
      animate={{
        x: flight.to.x - flight.from.x,
        y: flight.to.y - flight.from.y,
        rotate: [-8, 10, 0],
        scale: [0.8, 1.15, 0.9],
        opacity: [0, 1, 1, 0],
      }}
      transition={{ duration: 0.75, delay, ease: [0.3, 0.7, 0.4, 1] }}
      {...(props.onLand === undefined ? {} : { onAnimationComplete: props.onLand })}
    />
  );
}

/** Die Flüge der eigenen Ziehungen, über allem in einem Portal. */
export function DeckFlights({ game }: { readonly game: GameState }): ReactElement | null {
  const { flights, land } = useFlights(game);
  if (flights.length === 0) return null;
  return createPortal(
    <div className="deck-flights" aria-hidden="true">
      {flights.map((flight) =>
        Array.from({ length: flight.cards }, (_, index) => (
          <FlyingCard
            key={`${flight.id}-${String(index)}`}
            flight={flight}
            index={index}
            {...(index === flight.cards - 1 ? { onLand: () => land(flight.id) } : {})}
          />
        )),
      )}
    </div>,
    document.body,
  );
}
