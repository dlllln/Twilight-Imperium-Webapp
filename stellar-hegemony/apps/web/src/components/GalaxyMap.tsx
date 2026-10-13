import type { GameState, MapLayout } from '@stellar/domain';
import {
  forwardRef,
  lazy,
  memo,
  Suspense,
  type KeyboardEvent,
  type ReactElement,
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type MapEffect, mapEffects } from '../animation/map-effects.ts';
import { useGameStore } from '../game-store.ts';
import { type Bounds, hexToPixel, padBounds, type Point, toSvgPoints } from '../hex-geometry.ts';
import { boardBounds, type BoardView, project, projectedCorners } from '../render/board-view.ts';
import { useBoardView } from '../system/board-camera.ts';
import type { Language } from '../i18n.ts';
import { gameScene, layoutScene, type SceneHex } from '../render/scene-model.ts';
import { content, useGalaxyStore, type Viewport } from '../store.ts';
import { highlightsOf, movementChoices } from '../tactical-view.ts';
import { useSettingsStore } from '../settings-store.ts';
import { usePanZoom } from '../use-pan-zoom.ts';
import { HexTooltip } from './HexTooltip.tsx';
import { MapControls } from './MapControls.tsx';
import { glideCamera, useCameraStore } from '../system/camera-store.ts';
import { useElementSize } from '../system/use-element-size.ts';
import {
  boundsCenter,
  CLOSE_ZOOM,
  focusViewport,
  systemZoom,
  zoomAround,
} from '../system/viewport-tween.ts';
import { CloseUpLabels } from './CloseUpLabels.tsx';
import { HandDock } from './hand/HandDock.tsx';
import { PhaseDock } from './hud/PhaseDock.tsx';
import { PlayerRail } from './hud/PlayerRail.tsx';
import { ResourceBar } from './hud/ResourceBar.tsx';
import { SystemActions } from './hud/SystemActions.tsx';
import { TurnFloat } from './hud/TurnFloat.tsx';

/** Pixi wird nachgeladen, damit die Oberfläche sofort erscheint. */
const PixiCanvas = lazy(() =>
  import('./PixiCanvas.tsx').then((module) => ({ default: module.PixiCanvas })),
);

interface SceneInput {
  readonly layout: MapLayout;
  readonly game: GameState | null;
  readonly selected: string | null;
  readonly language: Language;
}

function sceneFor({ layout, game, selected, language }: SceneInput): readonly SceneHex[] {
  if (game === null) return layoutScene(layout, content, language);
  const highlights = highlightsOf(game, movementChoices(game, content), selected);
  return gameScene(game, content, language, highlights);
}

/** Szene aus Galaxie-Layout (Aufbau) oder Spielzustand (Partie). */
function useScene(): readonly SceneHex[] {
  const layout = useGalaxyStore((state) => state.layout);
  const language = useGalaxyStore((state) => state.language);
  const game = useGameStore((state) => state.game);
  const selected = useGameStore((state) => state.selected);
  return useMemo(
    () => sceneFor({ layout, game, selected, language }),
    [layout, game, selected, language],
  );
}

const NO_EFFECTS: readonly MapEffect[] = [];

/** In der Partie liegen Spieler links, Vorräte oben und die Hand unten über der Karte; dafür bleibt Platz. */
const HUD_MARGINS = { top: 80, bottom: 150, left: 230, right: 80 } as const;

function useBounds(hexes: readonly SceneHex[], view: BoardView): Bounds {
  const playing = useGameStore((state) => state.game !== null);
  return useMemo(() => {
    const bounds = boardBounds(
      view,
      hexes.map((hex) => hexToPixel(hex.position)),
    );
    return playing ? padBounds(bounds, HUD_MARGINS) : bounds;
  }, [hexes, view, playing]);
}

/** Effekte des letzten Zugs, wenn Animationen eingeschaltet sind. */
function useMapEffects(): readonly MapEffect[] {
  const last = useGameStore((state) => state.lastEvents);
  const animations = useSettingsStore((state) => state.animations);
  return useMemo(
    () => (animations && last !== null ? mapEffects(last.before, last.events) : NO_EFFECTS),
    [animations, last],
  );
}

const tileClass = (hex: SceneHex): string =>
  hex.kind === 'homeSlot' || hex.back === 'home' ? 'tile-home' : `tile-${hex.back}`;

interface TargetProps {
  readonly hex: SceneHex;
  readonly view: BoardView;
  readonly hovered: boolean;
  readonly onHover: (key: string | null) => void;
  readonly onPick: (hex: SceneHex) => void;
}

/** Unsichtbare Trefferfläche je Feld: Maus, Tastatur, Screenreader und E2E-Tests. */
function HexTarget({ hex, view, hovered, onHover, onPick }: TargetProps): ReactElement {
  const pickable = hex.systemId !== null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') onPick(hex);
  };
  return (
    <polygon
      points={toSvgPoints(projectedCorners(view, hexToPixel(hex.position)))}
      className={`hex ${tileClass(hex)} highlight-${hex.highlight}${hovered ? ' highlighted' : ''}`}
      data-slot={hex.key}
      data-system={hex.systemId ?? undefined}
      data-anomaly={hex.anomaly}
      data-seat={hex.seat ?? undefined}
      role={pickable ? 'button' : undefined}
      aria-label={hex.systemId ?? `${hex.kind} ${String(hex.seat)}`}
      tabIndex={pickable ? 0 : undefined}
      onPointerEnter={() => onHover(hex.key)}
      onPointerLeave={() => onHover(null)}
      onFocus={() => onHover(hex.key)}
      onClick={() => onPick(hex)}
      onKeyDown={onKeyDown}
    />
  );
}

interface TargetsProps {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly viewport: Viewport;
  readonly view: BoardView;
  readonly onPick: (hex: SceneHex) => void;
  readonly onView: (hex: SceneHex) => void;
}

const viewBoxOf = (b: Bounds): string =>
  [b.minX, b.minY, b.width, b.height].map((value) => String(value)).join(' ');

/** Knöpfe über dem in der Partie gewählten System. */
function ChosenActions({ hexes, bounds, viewport, view, onView }: Omit<TargetsProps, 'onPick'>) {
  const game = useGameStore((state) => state.game);
  const selected = useGameStore((state) => state.selected);
  const chosen = hexes.find((hex) => hex.systemId !== null && hex.systemId === selected);
  if (game === null || chosen === undefined) return null;
  return (
    <SystemActions
      game={game}
      hex={chosen}
      viewport={viewport}
      view={view}
      top={bounds.minY + HUD_MARGINS.top}
      bottom={bounds.minY + bounds.height - HUD_MARGINS.bottom}
      onView={onView}
    />
  );
}

/** SVG-Ebene über dem Pixi-Bild, mit derselben Abbildung wie `worldTransform`. */
const HexTargets = forwardRef<SVGSVGElement, TargetsProps>(function HexTargets(
  { hexes, bounds, viewport, view, onPick, onView },
  svg,
): ReactElement {
  const { hovered, hover } = useGalaxyStore();
  const { panX, panY, zoom } = viewport;
  return (
    <svg ref={svg} viewBox={viewBoxOf(bounds)} aria-label="galaxy">
      <g transform={`translate(${String(panX)} ${String(panY)}) scale(${String(zoom)})`}>
        {hexes.map((hex) => (
          <HexTarget
            key={hex.key}
            hex={hex}
            view={view}
            hovered={hex.key === hovered}
            onHover={hover}
            onPick={onPick}
          />
        ))}
      </g>
      <ChosenActions {...{ hexes, bounds, viewport, view, onView }} />
    </svg>
  );
});

const svgSize = (svg: RefObject<SVGSVGElement | null>) => ({
  width: svg.current?.clientWidth ?? 0,
  height: svg.current?.clientHeight ?? 0,
});

/** Fährt an ein System heran, bis es gut die Hälfte des Bildes füllt; in der Partie bleibt es gewählt. */
function useFlyTo(bounds: Bounds, view: BoardView, svg: RefObject<SVGSVGElement | null>) {
  return useCallback(
    (hex: SceneHex) => {
      if (hex.kind !== 'system') return;
      const { game, select } = useGameStore.getState();
      if (game !== null) select(hex.systemId);
      const at = project(view, hexToPixel(hex.position));
      const zoom = systemZoom(bounds, svgSize(svg), at.scale);
      useCameraStore.getState().focus(focusViewport(bounds, at, zoom));
    },
    [bounds, view, svg],
  );
}

/**
 * In der Partie wählt ein Klick das System und zeigt seine Knöpfe; ein zweiter Klick fährt
 * heran. Vor der Partie fährt schon der erste Klick heran. Wer die Karte zieht, verschiebt sie nur.
 */
function usePicking(wasDrag: () => boolean, flyTo: (hex: SceneHex) => void) {
  return (hex: SceneHex) => {
    if (wasDrag()) return;
    useSettingsStore.getState().markHintSeen();
    const { game, selected, select } = useGameStore.getState();
    if (game === null || hex.systemId === selected) flyTo(hex);
    else select(hex.systemId);
  };
}

/** Bildschirmpunkt in viewBox-Koordinaten (null, wenn der Browser es nicht kann, z. B. in Tests). */
function toViewBox(svg: SVGSVGElement | null, client: Point): Point | null {
  if (svg === null || !('getScreenCTM' in svg)) return null;
  const matrix = svg.getScreenCTM();
  if (matrix === null) return null;
  const point = new DOMPoint(client.x, client.y).matrixTransform(matrix.inverse());
  return { x: point.x, y: point.y };
}

/** Stufenloser Zoom zum Zeiger hin (ohne Zeiger zur Bildmitte), bis an einzelne Planeten. */
function useZoom(bounds: Bounds, svg: RefObject<SVGSVGElement | null>) {
  return (factor: number, client?: Point) => {
    const pointed = client === undefined ? null : toViewBox(svg.current, client);
    const anchor = pointed ?? boundsCenter(bounds);
    glideCamera((from) => zoomAround(from, factor, anchor));
  };
}

/** Escape fährt nach dem Heranfahren an die alte Stelle zurück. */
function useEscapeBack(): void {
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const { returnTo, back } = useCameraStore.getState();
      if (event.key === 'Escape' && returnTo !== null) back();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/** Gesten der Anzeigen über der Karte sollen die Karte darunter nicht verschieben. */
const shield = { onPointerDown: stop, onPointerMove: stop, onWheel: stop, onDoubleClick: stop };
function stop(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/** Anzeigen der Partie über der Karte: Spieler, Vorräte, Phase, offene Entscheidungen, Hand. */
function Hud({ game }: { readonly game: GameState }): ReactElement {
  return (
    <>
      <PlayerRail game={game} />
      <ResourceBar game={game} />
      <TurnFloat game={game} />
      <PhaseDock game={game} />
      <HandDock game={game} />
    </>
  );
}

/**
 * Oberhalb der Karte: die Anzeigen der Partie; ihre Gesten verschieben die Karte nicht.
 * Ohne Eigenschaften und mit `memo`: Kamerafahrten und Drehungen der Karte zeichnen sie nicht neu.
 */
const Overlays = memo(function Overlays(): ReactElement | null {
  const game = useGameStore((state) => state.game);
  if (game === null) return null;
  return (
    <div className="hud-shield" {...shield}>
      <Hud game={game} />
    </div>
  );
});

/** Kamera der Karte: Heranfahren an Systeme und stufenloser Zoom, beide über dieselbe SVG-Abbildung. */
function useMapCamera(bounds: Bounds, view: BoardView) {
  const svg = useRef<SVGSVGElement>(null);
  const flyTo = useFlyTo(bounds, view, svg);
  const zoom = useZoom(bounds, svg);
  const size = useElementSize(svg);
  useEscapeBack();
  return { svg, size, flyTo, zoom };
}

/** Ohne WebGL zeigt die Karte nur die SVG-Felder. */
function useFlatFallback(): readonly [boolean, () => void] {
  const [flat, setFlat] = useState(false);
  return [flat, useCallback(() => setFlat(true), [])];
}

/** Hinweis am Zeiger; beim Nahzoom übernehmen die Schilder an Planeten und Flotten, am Tablet die Knöpfe. */
function MapTooltip({
  hexes,
  cursor,
  touch,
}: {
  readonly hexes: readonly SceneHex[];
  readonly cursor: Point;
  readonly touch: boolean;
}) {
  const { hovered, viewport } = useGalaxyStore();
  const hex = hexes.find((candidate) => candidate.key === hovered);
  // Mit dem Finger gibt es kein Zeigen ohne Tippen: dort übernehmen Knöpfe und Nahzoom.
  if (hex === undefined || touch || viewport.zoom >= CLOSE_ZOOM) return null;
  return <HexTooltip hex={hex} x={cursor.x} y={cursor.y} />;
}

export function GalaxyMap(): ReactElement {
  const viewport = useGalaxyStore((state) => state.viewport);
  const hexes = useScene();
  const effects = useMapEffects();
  const { view, target } = useBoardView(hexes);
  const bounds = useBounds(hexes, target);
  const { svg, size, flyTo, zoom } = useMapCamera(bounds, view);
  const { cursor, touch, wasDrag, ...handlers } = usePanZoom(svg, bounds.width, zoom);
  const [flat, onUnavailable] = useFlatFallback();
  const pick = usePicking(wasDrag, flyTo);
  return (
    <div className={flat ? 'galaxy flat' : 'galaxy'} data-tutorial="galaxy" {...handlers}>
      {!flat && (
        <Suspense fallback={null}>
          <PixiCanvas {...{ hexes, bounds, viewport, view, effects, onUnavailable }} />
        </Suspense>
      )}
      <HexTargets {...{ hexes, bounds, viewport, view }} ref={svg} onPick={pick} onView={flyTo} />
      <CloseUpLabels {...{ hexes, bounds, viewport, view, size }} />
      <MapTooltip hexes={hexes} cursor={cursor} touch={touch} />
      <MapControls onZoom={(factor) => zoom(factor)} onReset={useCameraStore.getState().back} />
      <Overlays />
    </div>
  );
}
