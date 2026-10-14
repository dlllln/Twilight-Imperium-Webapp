import { type Container, Graphics, PerspectiveMesh, type Texture } from 'pixi.js';
import type { Point } from '../hex-geometry.ts';
import { type BoardView, foreshorten, lift, plus, project, turn } from './board-view.ts';

/*
 * Bausteine der schrägen Karte: Jedes Stück wird einmal gebaut und bei jedem neuen Blick
 * (Drehen des Bretts) oder jeder Detailstufe (Zoom) nur neu ausgerichtet, nicht neu erzeugt.
 */

export interface BoardFrame {
  readonly view: BoardView;
  /** Faktor für Strichstärken auf der aktuellen Detailstufe (siehe `lineScale`). */
  readonly line: number;
}

/** Ein Stück der Karte, das sich auf einen Blick ausrichtet (Strategy). */
export interface Placed {
  readonly arrange: (frame: BoardFrame) => void;
}

const SIGNS = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
] as const;
const GRID = 8;

/** Bild, das flach auf dem Brett liegt (Kachel, Anomalie): seine vier Ecken werden projiziert. */
export function flatImage(layer: Container, texture: Texture, center: Point, half: Point): Placed {
  const mesh = new PerspectiveMesh({ texture, verticesX: GRID, verticesY: GRID });
  layer.addChild(mesh);
  return {
    arrange: ({ view }) => {
      const [a, b, c, d] = SIGNS.map(([sx, sy]) =>
        project(view, { x: center.x + sx * half.x, y: center.y + sy * half.y }),
      );
      if (a === undefined || b === undefined || c === undefined || d === undefined) return;
      mesh.setCorners(a.x, a.y, b.x, b.y, c.x, c.y, d.x, d.y);
    },
  };
}

/** Vektorgrafik in Bildkoordinaten, bei jedem Ausrichten neu gezeichnet (scharf in jeder Lage). */
export function stroked(
  layer: Container,
  draw: (graphics: Graphics, frame: BoardFrame) => void,
): Placed & { readonly graphics: Graphics } {
  const graphics = new Graphics();
  layer.addChild(graphics);
  return {
    graphics,
    arrange: (frame) => {
      graphics.clear();
      draw(graphics, frame);
    },
  };
}

/** Wo eine Figur steht: Feldmitte auf der Karte plus Versatz in Blickrichtung des Betrachters. */
export interface Footing {
  readonly center: Point;
  readonly offset: Point;
  /** Höhe über dem Brett (Planeten schweben, Schiffe fliegen). */
  readonly height?: number;
  /** Flach auf dem Brett (Schatten, Marker): in der Höhe gestaucht. */
  readonly flat?: boolean;
}

/**
 * Figur, die dem Betrachter zugewandt auf dem Brett steht: Planeten, Schiffe, Zahlen.
 * Ihre Anordnung im Feld dreht sich nicht mit, Flotten stehen also immer vorne.
 * Weiter vorn stehende Figuren verdecken die hinteren (`zIndex` nach Bildhöhe).
 */
export function standing(footing: Footing, parts: readonly (readonly [Container, Container])[]) {
  for (const [layer, display] of parts) layer.addChild(display);
  const arrange = ({ view }: BoardFrame) => {
    const at = lift(
      plus(turn(view, footing.center), footing.offset),
      footing.height ?? 0,
      view.tilt,
    );
    const squash = footing.flat === true ? foreshorten(view) : 1;
    for (const [, display] of parts) {
      display.position.set(at.x, at.y);
      display.scale.set(at.scale, at.scale * squash);
      display.zIndex = at.y;
    }
  };
  return { arrange };
}
