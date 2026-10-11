import { type GameState, systemId } from '@stellar/domain';
import { Crosshair, type LucideIcon, ZoomIn } from 'lucide-react';
import type { PointerEvent, ReactElement } from 'react';
import { useGameStore, useHumanActor } from '../../game-store.ts';
import { HEX_SIZE, hexToPixel } from '../../hex-geometry.ts';
import { type SystemAction, systemActions } from '../../hud/system-actions.ts';
import type { MessageKey } from '../../i18n.ts';
import type { SceneHex } from '../../render/scene-model.ts';
import type { Viewport } from '../../store.ts';
import { useT } from '../../use-translation.ts';

/** Knopfgröße in Karteneinheiten; sie wächst nicht mit dem Zoom mit. */
const BUTTON = 46;
const GAP = 8;
const LIFT = 10;
const HALF_HEIGHT = (HEX_SIZE * Math.sqrt(3)) / 2;

const LOOKS: Readonly<Record<SystemAction, readonly [LucideIcon, MessageKey]>> = {
  view: [ZoomIn, 'viewSystem'],
  activate: [Crosshair, 'activateSystem'],
};

const keepMap = (event: PointerEvent) => event.stopPropagation();

interface Props {
  readonly game: GameState;
  readonly hex: SceneHex;
  readonly viewport: Viewport;
  /** Unterkante der Vorratsleiste; reicht der Platz darunter nicht, stehen die Knöpfe unter dem Feld. */
  readonly top: number;
  /** Oberkante der Hand; ist das Feld größer als das Bild, bleiben die Knöpfe oben im Bild. */
  readonly bottom: number;
  readonly onView: (hex: SceneHex) => void;
}

function useRun(game: GameState, hex: SceneHex, onView: Props['onView']) {
  const send = useGameStore((state) => state.send);
  const actor = useHumanActor(game);
  return (action: SystemAction) => {
    if (action === 'view') onView(hex);
    else if (actor !== null && hex.systemId !== null)
      send({ type: 'ActivateSystem', issuedBy: actor, system: systemId(hex.systemId) });
  };
}

function ActionButton({
  action,
  onRun,
}: {
  readonly action: SystemAction;
  readonly onRun: () => void;
}) {
  const t = useT();
  const [Icon, label] = LOOKS[action];
  return (
    <button
      type="button"
      className={`hex-action ${action}`}
      aria-label={t(label)}
      title={t(label)}
      onClick={onRun}
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}

interface Band {
  readonly top: number;
  readonly bottom: number;
}

/** Über dem Feld, sonst darunter; passt beides nicht (nah herangezoomt), oben im Bild. */
function rowY(above: number, below: number, band: Band): number {
  if (above >= band.top) return above;
  if (below + BUTTON <= band.bottom) return below;
  return band.top + LIFT;
}

/** Lage der Knopfreihe in Karteneinheiten wie die Trefferflächen. */
function placement(hex: SceneHex, viewport: Viewport, count: number, band: Band) {
  const center = hexToPixel(hex.position);
  const width = count * BUTTON + (count - 1) * GAP;
  const x = viewport.panX + center.x * viewport.zoom - width / 2;
  const above = viewport.panY + (center.y - HALF_HEIGHT) * viewport.zoom - BUTTON - LIFT;
  const below = viewport.panY + (center.y + HALF_HEIGHT) * viewport.zoom + LIFT;
  return { x, y: rowY(above, below, band), width, height: BUTTON };
}

/** Sechseckige Knöpfe über dem gewählten System, wie Marker auf dem Spielbrett. */
export function SystemActions(props: Props): ReactElement | null {
  const { game, hex, viewport, top, bottom, onView } = props;
  const actor = useHumanActor(game);
  const seed = useGameStore((state) => state.seed);
  const run = useRun(game, hex, onView);
  if (hex.systemId === null) return null;
  const actions = systemActions(game, actor, hex.systemId, seed);
  return (
    <foreignObject
      {...placement(hex, viewport, actions.length, { top, bottom })}
      className="system-actions-host"
    >
      <div className="system-actions" onPointerDown={keepMap}>
        {actions.map((action) => (
          <ActionButton key={action} action={action} onRun={() => run(action)} />
        ))}
      </div>
    </foreignObject>
  );
}
