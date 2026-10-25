import {
  type GameState,
  hitChoice,
  type PlayerId,
  shipsOf,
  type SystemId,
  technologyCatalog,
  type Unit,
  type UnitId,
} from '@stellar/domain';
import { type ReactElement, useRef } from 'react';
import {
  battleSides,
  type CombatLogEvent,
  combatRole,
  combatSystemOf,
  isSpaceBattle,
  latestVolleys,
} from '../../combat-view.ts';
import { useGameStore, useViewer } from '../../game-store.ts';
import { systemLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import type { TableSpecId } from '../../table/table-specs.ts';
import { HIT_PEG, type DropHandler } from '../../table/target-ref.ts';
import { useDragSource } from '../../table/use-drag-source.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import { type TableDecision, useTableDecision } from '../../table/use-table-decision.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayableCards } from '../cards/PlayableCards.tsx';
import { VolleyDice } from '../combat/VolleyDice.tsx';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { HitPeg } from './HitPeg.tsx';
import { MatFigure, MatTarget } from './MatShip.tsx';
import { useMatFloor } from './use-mat-floor.ts';
import '../cards/card-table.css';
import './research-spread.css';
import './battle-mat.css';

/*
 * Die Kampfmatte (RR 63, RR 89.1): Statt der Kampfansicht über allem liegt der Kampf als Matte
 * in der freien Mitte, wie die Forschungsauslage; Karte, Pult und Ansage bleiben bedienbar. Je
 * Seite die Schiffe des Systems, darüber der Stiftkasten, darunter die Würfelschale mit dem
 * jüngsten Wurf. Wer Treffer verteilt, zieht rote Stifte auf seine Schiffe oder tippt sie an; das Siegel
 * der Ansage bestätigt. Beim Rückzug leuchten die Ziele auf der Karte.
 */

/** Entscheidungen, die auf der Matte gespielt werden. */
const MAT_SPECS: ReadonlySet<TableSpecId> = new Set(['hits', 'retreat']);
/** Daneben darf die Matte offen liegen bleiben: Karten vor und während des Kampfs. */
const BESIDE: ReadonlySet<TableSpecId> = new Set(['reaction']);

interface MatState {
  readonly system: SystemId;
  readonly log: readonly CombatLogEvent[];
  /** Die eigene Entscheidung auf der Matte, sonst `null`. */
  readonly decision: TableDecision | null;
}

const onMat = (decision: TableDecision | null): decision is TableDecision =>
  decision?.specId != null && MAT_SPECS.has(decision.specId);

/** Offen gelassen bleibt die Matte liegen, bis eine andere Entscheidung am Tisch beginnt. */
const besideOf = (decision: TableDecision | null): boolean =>
  decision?.specId == null || BESIDE.has(decision.specId);

/** Das umkämpfte System: das der laufenden Taktikaktion, sonst das des Protokolls. */
const systemOf = (game: GameState, log: readonly CombatLogEvent[]): SystemId | null =>
  game.actionPhase?.tactical?.system ?? combatSystemOf(log);

function useBattleMat(game: GameState): MatState | null {
  const decision = useTableDecision(game);
  const open = useGameStore((state) => state.combatOpen);
  const log = useGameStore((state) => state.combatLog);
  const system = systemOf(game, log);
  const deciding = onMat(decision);
  const shown = deciding || (open && log.length > 0 && besideOf(decision));
  if (system === null || !shown) return null;
  return { system, log, decision: deciding ? decision : null };
}

/** Die Schiffe, die gerade Treffer nehmen (nur bei der eigenen Trefferzuweisung). */
function hitUnits(game: GameState, decision: TableDecision | null): ReadonlySet<UnitId> {
  if (decision?.specId !== 'hits' || decision.route.actor === null) return new Set();
  const choice = hitChoice(game, decision.route.actor, technologyCatalog(game, content));
  return new Set(choice?.units.map(({ unit }) => unit.id) ?? []);
}

interface SideProps {
  readonly game: GameState;
  readonly mat: MatState;
  readonly player: PlayerId;
  readonly takers: ReadonlySet<UnitId>;
  readonly router: DropHandler;
}

/** Eine Seite: Rolle, Spieler, Schiffe; die treffbaren sind Knöpfe. */
function MatSide({ game, mat, player, takers, router }: SideProps): ReactElement {
  const t = useT();
  const ships = shipsOf(game, mat.system, player, technologyCatalog(game, content));
  const role = combatRole(game, mat.log, player);
  const ship = (unit: Unit) =>
    mat.decision !== null && takers.has(unit.id) ? (
      <MatTarget key={unit.id} game={game} unit={unit} decision={mat.decision} router={router} />
    ) : (
      <MatFigure key={unit.id} game={game} unit={unit} />
    );
  return (
    <section className="mat-side" data-player={player} data-role={role}>
      <header>
        <span className="mat-role">{t(role)}</span>
        <PlayerTag game={game} id={player} />
      </header>
      <div className="mat-ships">
        {ships.length === 0 ? <p className="hint">{t('noShipsLeft')}</p> : ships.map(ship)}
      </div>
    </section>
  );
}

/** So viele Stifte liegen sichtbar im Kasten; die Zahl daneben zählt alle. */
const PILE = 6;

/** Der Stiftkasten: noch freie Stifte; einer lässt sich aufnehmen und auf ein Schiff legen. */
function PegTray(props: { readonly decision: TableDecision; readonly router: DropHandler }) {
  const t = useT();
  const { decision, router } = props;
  const drag = useDragSource(HIT_PEG, () => decision.legalFor(HIT_PEG), router);
  const { progress } = decision;
  const free = progress === null ? 0 : Math.max(0, progress.needed - progress.done);
  const left = t('pegsLeft').replace('{n}', String(free));
  return (
    <div className="peg-tray" data-free={free}>
      {free > 0 && (
        <button type="button" className="peg-pile" aria-label={t('pickUpPeg')} {...drag}>
          {Array.from({ length: Math.min(free, PILE) }, (_, index) => (
            <HitPeg key={index} />
          ))}
        </button>
      )}
      <span className="peg-tray-count" aria-live="polite">
        {t('hitPegs')}: {left}
      </span>
    </div>
  );
}

/** Die Würfelschale: der jüngste Wurf; den eigenen holt „Würfeln“ aus dem Becher. */
function MatDice({ game, log }: { readonly game: GameState; readonly log: MatState['log'] }) {
  const t = useT();
  const viewer = useViewer();
  const volleys = latestVolleys(log);
  if (volleys.length === 0) return null;
  return (
    <section className="mat-dice" aria-label={t('latestRoll')}>
      {volleys.map((volley, index) => (
        <VolleyDice
          key={`${volley.player}-${String(index)}`}
          game={game}
          volley={volley}
          gated={volley.player === viewer}
        />
      ))}
    </section>
  );
}

/** Kopf: Raumkampf oder Einmarsch, das System; ohne eigene Entscheidung der Knopf zum Schließen. */
function MatHeader({ game, mat }: { readonly game: GameState; readonly mat: MatState }) {
  const t = useT();
  const language = useLanguage();
  const close = useGameStore((state) => state.closeCombat);
  return (
    <header className="card-table-header battle-mat-header">
      <div className="card-table-kicker">
        <span>{t('battleMat')}</span>
        <span>{systemLabel(game, mat.system, language)}</span>
      </div>
      <h2>{t(isSpaceBattle(mat.log) ? 'spaceCombat' : 'invasion')}</h2>
      {mat.decision === null && (
        <button type="button" className="battle-mat-close" onClick={close}>
          {t('closeCombat')}
        </button>
      )}
    </header>
  );
}

/** Karten gegen Treffer liegen bei der eigenen Trefferzuweisung direkt an der Matte (RR 3.10). */
function HitCards({ game, mat }: { readonly game: GameState; readonly mat: MatState }) {
  const actor = mat.decision?.specId === 'hits' ? mat.decision.route.actor : null;
  if (actor === null) return null;
  return <PlayableCards game={game} player={actor} timings={['afterHits']} />;
}

/** Die Kampfmatte des laufenden Kampfs; ohne Kampf liegt nichts auf dem Tisch. */
export function BattleMat({ game }: { readonly game: GameState }): ReactElement | null {
  const t = useT();
  const mat = useBattleMat(game);
  const router = useDropRouter(game);
  const ref = useRef<HTMLElement>(null);
  useMatFloor(ref, mat !== null);
  if (mat === null) return null;
  const takers = hitUnits(game, mat.decision);
  return (
    <section
      ref={ref}
      className="research-spread battle-mat"
      role="region"
      aria-label={t('battleMat')}
      data-testid="battle-mat"
      data-deciding={mat.decision?.specId ?? undefined}
    >
      <MatHeader game={game} mat={mat} />
      {mat.decision?.specId === 'hits' && <PegTray decision={mat.decision} router={router} />}
      <div className="mat-sides">
        {battleSides(game, mat.log).map((player) => (
          <MatSide key={player} {...{ game, mat, player, takers, router }} />
        ))}
      </div>
      <HitCards game={game} mat={mat} />
      <MatDice game={game} log={mat.log} />
    </section>
  );
}
