import type { GameState, MapLayout } from '@stellar/domain';
import {
  forwardRef,
  lazy,
  Suspense,
  type KeyboardEvent,
  type ReactElement,
  useCallback,
  useMemo,
  useRef,
  useState,
} from 'react';
import { type MapEffect, mapEffects } from '../animation/map-effects.ts';
import { useGameStore } from '../game-store.ts';
import { type Bounds, boundsOf, hexCorners, hexToPixel, toSvgPoints } from '../hex-geometry.ts';
import type { Language } from '../i18n.ts';
import { gameScene, layoutScene, type SceneHex } from '../render/scene-model.ts';
import { content, useGalaxyStore, type Viewport } from '../store.ts';
import { highlightsOf, movementChoices } from '../tactical-view.ts';
import { useSettingsStore } from '../settings-store.ts';
import { usePanZoom } from '../use-pan-zoom.ts';
import { HexTooltip } from './HexTooltip.tsx';
import { MapControls } from './MapControls.tsx';
import { SystemView } from './system/SystemView.tsx';
import { useSystemViewStore } from '../system/system-view-store.ts';
import { focusViewport, reachesSystem, viewCenter } from '../system/viewport-tween.ts';
import { HandDock } from './hand/HandDock.tsx';

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
  readonly hovered: boolean;
  readonly onHover: (key: string | null) => void;
  readonly onPick: (hex: SceneHex) => void;
}

/** Unsichtbare Trefferfläche je Feld: Maus, Tastatur, Screenreader und E2E-Tests. */
function HexTarget({ hex, hovered, onHover, onPick }: TargetProps): ReactElement {
  const pickable = hex.systemId !== null;
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter' || event.key === ' ') onPick(hex);
  };
  return (
    <polygon
      points={toSvgPoints(hexCorners(hexToPixel(hex.position)))}
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
  readonly onPick: (hex: SceneHex) => void;
}

const viewBoxOf = (b: Bounds): string =>
  [b.minX, b.minY, b.width, b.height].map((value) => String(value)).join(' ');

/** SVG-Ebene über dem Pixi-Bild, mit derselben Abbildung wie `worldTransform`. */
const HexTargets = forwardRef<SVGSVGElement, TargetsProps>(function HexTargets(
  { hexes, bounds, viewport, onPick },
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
            hovered={hex.key === hovered}
            onHover={hover}
            onPick={onPick}
          />
        ))}
      </g>
    </svg>
  );
});

/** Kamerafahrt in ein System, das in der Partie zugleich ausgewählt wird; Heimat-Plätze vor der Partie haben keinen Inhalt. */
function useOpenSystem(bounds: Bounds) {
  return useCallback(
    (hex: SceneHex) => {
      if (hex.kind !== 'system') return;
      const { game, select } = useGameStore.getState();
      if (game !== null) select(hex.systemId);
      const focus = focusViewport(bounds, hexToPixel(hex.position));
      useSystemViewStore.getState().open(hex.key, focus);
    },
    [bounds],
  );
}

/** Ein Klick fährt in das Feld hinein; wer dabei die Karte gezogen hat, verschiebt sie nur. */
function usePicking(wasDrag: () => boolean, open: (hex: SceneHex) => void) {
  return (hex: SceneHex) => {
    if (!wasDrag()) open(hex);
  };
}

/** Nächstes System zur Bildmitte; der Mauszeiger hat Vorrang, wenn er auf einem steht. */
function systemNear(hexes: readonly SceneHex[], point: { x: number; y: number }) {
  const distance = (hex: SceneHex) => {
    const center = hexToPixel(hex.position);
    return Math.hypot(center.x - point.x, center.y - point.y);
  };
  const systems = hexes.filter((hex) => hex.kind === 'system');
  return systems.reduce<SceneHex | undefined>(
    (best, hex) => (best === undefined || distance(hex) < distance(best) ? hex : best),
    undefined,
  );
}

/** Zoomen; erreicht der Zoom die Schwelle, öffnet sich das System unter dem Zeiger oder mittig. */
function useZoom(hexes: readonly SceneHex[], bounds: Bounds, open: (hex: SceneHex) => void) {
  return (factor: number) => {
    const { viewport, zoomBy, hovered } = useGalaxyStore.getState();
    zoomBy(factor);
    if (!reachesSystem(viewport.zoom, factor)) return;
    const pointed = hexes.find((hex) => hex.key === hovered && hex.kind === 'system');
    const target = pointed ?? systemNear(hexes, viewCenter(bounds, viewport));
    if (target !== undefined) open(target);
  };
}

/** Ereignisse der Systemansicht sollen die Karte darunter nicht verschieben. */
const shield = { onPointerDown: stop, onPointerMove: stop, onWheel: stop, onDoubleClick: stop };
function stop(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

/** Oberhalb der Karte: Systemansicht und Hand; ihre Gesten verschieben die Karte nicht. */
function Overlays({ hexes }: { readonly hexes: readonly SceneHex[] }): ReactElement {
  const game = useGameStore((state) => state.game);
  return (
    <div className="system-shield" {...shield}>
      <SystemView hexes={hexes} />
      {game !== null && <HandDock game={game} />}
    </div>
  );
}

export function GalaxyMap(): ReactElement {
  const { hovered, viewport } = useGalaxyStore();
  const hexes = useScene();
  const effects = useMapEffects();
  const bounds = useMemo(() => boundsOf(hexes.map((hex) => hex.position)), [hexes]);
  const svg = useRef<SVGSVGElement>(null);
  const open = useOpenSystem(bounds);
  const zoom = useZoom(hexes, bounds, open);
  const { cursor, wasDrag, ...handlers } = usePanZoom(svg, bounds.width, zoom);
  const [flat, setFlat] = useState(false);
  const pick = usePicking(wasDrag, open);
  const onUnavailable = useCallback(() => setFlat(true), []);
  const systemOpen = useSystemViewStore((state) => state.key !== null);
  const hoveredHex = systemOpen ? undefined : hexes.find((hex) => hex.key === hovered);
  return (
    <div className={flat ? 'galaxy flat' : 'galaxy'} data-tutorial="galaxy" {...handlers}>
      {!flat && (
        <Suspense fallback={null}>
          <PixiCanvas {...{ hexes, bounds, viewport, effects, onUnavailable }} />
        </Suspense>
      )}
      <HexTargets {...{ hexes, bounds, viewport }} ref={svg} onPick={pick} />
      {hoveredHex !== undefined && <HexTooltip hex={hoveredHex} x={cursor.x} y={cursor.y} />}
      <MapControls onZoom={zoom} onReset={() => useGalaxyStore.getState().resetView()} />
      <Overlays hexes={hexes} />
    </div>
  );
}
