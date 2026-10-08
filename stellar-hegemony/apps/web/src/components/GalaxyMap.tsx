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
import { focusViewport } from '../system/viewport-tween.ts';

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
  readonly onOpen: (hex: SceneHex) => void;
}

/** Unsichtbare Trefferfläche je Feld: Maus, Tastatur, Screenreader und E2E-Tests. */
function HexTarget({ hex, hovered, onHover, onPick, onOpen }: TargetProps): ReactElement {
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
      onDoubleClick={() => onOpen(hex)}
      onKeyDown={onKeyDown}
    />
  );
}

interface TargetsProps {
  readonly hexes: readonly SceneHex[];
  readonly bounds: Bounds;
  readonly viewport: Viewport;
  readonly onPick: (hex: SceneHex) => void;
  readonly onOpen: (hex: SceneHex) => void;
}

const viewBoxOf = (b: Bounds): string =>
  [b.minX, b.minY, b.width, b.height].map((value) => String(value)).join(' ');

/** SVG-Ebene über dem Pixi-Bild, mit derselben Abbildung wie `worldTransform`. */
const HexTargets = forwardRef<SVGSVGElement, TargetsProps>(function HexTargets(
  { hexes, bounds, viewport, onPick, onOpen },
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
            onOpen={onOpen}
          />
        ))}
      </g>
    </svg>
  );
});

/** Kamerafahrt in ein System; Heimat-Plätze vor der Partie haben keinen Inhalt. */
function useOpenSystem(bounds: Bounds) {
  return useCallback(
    (hex: SceneHex) => {
      if (hex.kind !== 'system') return;
      const focus = focusViewport(bounds, hexToPixel(hex.position));
      useSystemViewStore.getState().open(hex.key, focus);
    },
    [bounds],
  );
}

/** Ein Klick merkt sich das Feld (für „Ins System zoomen“) und wählt es in der Partie aus. */
function usePicking(wasDrag: () => boolean) {
  const [picked, setPicked] = useState<SceneHex | null>(null);
  const pick = (hex: SceneHex) => {
    if (wasDrag()) return;
    setPicked(hex);
    const { game, select } = useGameStore.getState();
    if (game !== null) select(hex.systemId);
  };
  return { picked, pick };
}

/** Ereignisse der Systemansicht sollen die Karte darunter nicht verschieben. */
const shield = { onPointerDown: stop, onPointerMove: stop, onWheel: stop, onDoubleClick: stop };
function stop(event: { stopPropagation: () => void }) {
  event.stopPropagation();
}

export function GalaxyMap(): ReactElement {
  const { hovered, viewport } = useGalaxyStore();
  const hexes = useScene();
  const effects = useMapEffects();
  const bounds = useMemo(() => boundsOf(hexes.map((hex) => hex.position)), [hexes]);
  const svg = useRef<SVGSVGElement>(null);
  const { cursor, wasDrag, ...handlers } = usePanZoom(svg, bounds.width);
  const [flat, setFlat] = useState(false);
  const { picked, pick } = usePicking(wasDrag);
  const onUnavailable = useCallback(() => setFlat(true), []);
  const open = useOpenSystem(bounds);
  const systemOpen = useSystemViewStore((state) => state.key !== null);
  const hoveredHex = systemOpen ? undefined : hexes.find((hex) => hex.key === hovered);
  return (
    <div className={flat ? 'galaxy flat' : 'galaxy'} data-tutorial="galaxy" {...handlers}>
      {!flat && (
        <Suspense fallback={null}>
          <PixiCanvas {...{ hexes, bounds, viewport, effects, onUnavailable }} />
        </Suspense>
      )}
      <HexTargets {...{ hexes, bounds, viewport }} ref={svg} onPick={pick} onOpen={open} />
      {hoveredHex !== undefined && <HexTooltip hex={hoveredHex} x={cursor.x} y={cursor.y} />}
      <MapControls onOpen={picked?.kind === 'system' ? () => open(picked) : null} />
      <div className="system-shield" {...shield}>
        <SystemView hexes={hexes} />
      </div>
    </div>
  );
}
