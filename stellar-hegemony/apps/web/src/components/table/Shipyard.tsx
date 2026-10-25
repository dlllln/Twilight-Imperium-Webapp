import type { PlanetId, ProductionChoice } from '@stellar/domain';
import {
  type CSSProperties,
  type ReactElement,
  type RefObject,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import { unitArtwork } from '../../artwork/units.ts';
import { planetLabel, unitLabel } from '../../labels.ts';
import { seatColor } from '../../seat-colors.ts';
import { cheapFirst, type Shipyard as Yard, shipyardOf } from '../../table/shipyard.ts';
import { DOCK, type DropHandler, yardPiece } from '../../table/target-ref.ts';
import { useDragSource } from '../../table/use-drag-source.ts';
import { useDropRouter } from '../../table/use-drop-router.ts';
import type { TableDecision } from '../../table/use-table-decision.ts';
import { useTarget } from '../../table/use-target.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import type { PartProps } from './PromptParts.tsx';
import { revealInPrompt } from './prompt-scroll.ts';
import { seatNumberOf } from './StructureTray.tsx';
import './shipyard.css';

/*
 * Die Werft in der Ansage (RR 62): Jede baubare Einheitenart liegt als Spielstein mit Kosten und
 * Vorrat bereit. Aufgenommen (ziehen, klicken oder Enter) und ins Dock oder auf das leuchtende
 * System gelegt, wird sie bestellt; Bodentruppen auf einem Planeten mit Produktion gehen dorthin.
 * Plus und Minus sind der zweite Weg. Was passt, sagt die Werft (also die Domain), nie die Anzeige.
 * Günstige Einheiten (Jäger, Infanterie) liegen vorn; jeder Stein trägt seinen Namen.
 */

type Translate = ReturnType<typeof useT>;

interface YardProps {
  readonly yard: Yard;
  readonly decision: TableDecision;
  readonly router: DropHandler;
  readonly seat: number;
}

/** Das Bild der Einheit in der Platzfarbe; ohne Bild ein Sechseck in Platzfarbe. */
function UnitFigure({ type, seat }: { readonly type: string; readonly seat: number }) {
  const artwork = unitArtwork(type, seat);
  if (artwork === null) return <span className="structure-piece-shape" aria-hidden="true" />;
  return <img src={artwork} alt="" draggable={false} />;
}

/** „Kosten 1“ bzw. „Kosten 1 je zwei“ (Jäger, Infanterie); ohne Kosten nichts. */
function costText(t: Translate, choice: ProductionChoice): string | null {
  const cost = choice.unit.cost;
  if (cost === undefined) return null;
  const key = cost.unitsPerCost > 1 ? 'unitCostPair' : 'unitCost';
  return t(key).replace('{cost}', String(cost.resources));
}

/** Kosten und, bei begrenztem Vorrat, was nach der Bestellung übrig bleibt. */
function Plate({ choice }: { readonly choice: ProductionChoice }): ReactElement {
  const t = useT();
  const cost = costText(t, choice);
  const { supply } = choice;
  return (
    <>
      {cost !== null && <span className="shipyard-cost">{cost}</span>}
      {supply !== null && (
        <span className="shipyard-supply">
          {t('unitSupply').replace('{count}', String(supply))}
        </span>
      )}
    </>
  );
}

interface StepProps {
  readonly name: string;
  readonly choice: ProductionChoice;
  readonly decision: TableDecision;
}

/** Minus und Plus wie am Pult; dieselben Namen wie im klassischen Formular („Infanterie +“). */
function OrderSteps({ name, choice, decision }: StepProps): ReactElement {
  const type = choice.unit.id;
  const step = (delta: 1 | -1) => decision.act({ kind: 'order', type, delta, planet: null });
  return (
    <div className="rail-controls">
      <button
        type="button"
        className="rail-step"
        aria-label={`${name} −`}
        disabled={choice.ordered <= 0}
        onClick={() => step(-1)}
      >
        −
      </button>
      <output aria-label={name}>{choice.ordered}</output>
      <button
        type="button"
        className="rail-step"
        aria-label={`${name} +`}
        disabled={!choice.canAdd}
        onClick={() => step(1)}
      >
        +
      </button>
    </div>
  );
}

interface PieceProps extends Omit<YardProps, 'yard'> {
  readonly choice: ProductionChoice;
}

/** Ein Spielstein der Werft; passt keine weitere Einheit dieser Art, lässt er sich nicht aufnehmen. */
function YardPiece({ choice, decision, router, seat }: PieceProps): ReactElement {
  const t = useT();
  const language = useLanguage();
  const type = choice.unit.id;
  const piece = yardPiece(type);
  const drag = useDragSource(piece, () => decision.legalFor(piece), router);
  const name = unitLabel(type, language);
  return (
    <li className="shipyard-piece" data-unit={type} data-ordered={choice.ordered}>
      <button
        type="button"
        className="structure-piece shipyard-figure"
        aria-label={`${t('pickUpUnit')}: ${name}`}
        disabled={!choice.canAdd}
        {...drag}
      >
        <UnitFigure type={type} seat={seat} />
      </button>
      <span className="shipyard-name" aria-hidden="true">
        {name}
      </span>
      <Plate choice={choice} />
      <OrderSteps name={name} choice={choice} decision={decision} />
    </li>
  );
}

/** Die bestellten Einheiten in Reihenfolge der Werft, je Einheit ein Eintrag. */
const dockedOf = (yard: Yard): readonly string[] =>
  yard.choices.flatMap((choice) =>
    Array.from({ length: choice.ordered }, () => String(choice.unit.id)),
  );

/** Ein Platz im Dock: leer oder mit der kleinen Figur einer bestellten Einheit. */
function Berth({ type, seat }: { readonly type: string | undefined; readonly seat: number }) {
  return (
    <span className={`shipyard-berth${type === undefined ? '' : ' filled'}`} aria-hidden="true">
      {type !== undefined && <UnitFigure type={type} seat={seat} />}
    </span>
  );
}

/** Das Dock: so viele Plätze wie der Produktionswert, belegt von den bestellten Einheiten. */
function Dock({ yard, router, seat }: Omit<YardProps, 'decision'>): ReactElement {
  const t = useT();
  const target = useTarget(DOCK, undefined, router);
  const legal = target.state === 'legal';
  const docked = dockedOf(yard);
  const { count, limit } = yard.quote;
  const berths = Array.from({ length: Math.max(limit, count) }, (_, at) => docked[at]);
  return (
    <div
      className={`shipyard-dock${target.over ? ' target-over' : ''}`}
      role="button"
      tabIndex={legal ? 0 : -1}
      aria-disabled={!legal}
      aria-label={`${t('shipyardDock')} – ${t('dockCount')}: ${String(count)} / ${String(limit)}`}
      {...target.props}
    >
      {berths.map((type, at) => (
        <Berth key={at} type={type} seat={seat} />
      ))}
    </div>
  );
}

/** Wohin neue Bodentruppen gehen; bei mehreren Planeten wählen Knöpfe (Weg per Tastatur). */
function GroundLine({ yard, decision }: Omit<YardProps, 'router' | 'seat'>) {
  const t = useT();
  const language = useLanguage();
  const { groundPlanet, needsGround } = yard;
  const planets = yard.quote.groundPlanets;
  if (!needsGround || groundPlanet === null) return null;
  const choose = (planet: PlanetId) => decision.act({ kind: 'site', planet });
  return (
    <div className="shipyard-ground">
      <span>
        {t('groundPlanet')}: <strong>{planetLabel(groundPlanet, language)}</strong>
      </span>
      {planets.length > 1 && (
        <span className="shipyard-ground-pick" role="group" aria-label={t('groundPlanet')}>
          {planets.map((planet) => (
            <button
              key={planet}
              type="button"
              aria-pressed={planet === groundPlanet}
              onClick={() => choose(planet)}
            >
              {planetLabel(planet, language)}
            </button>
          ))}
        </span>
      )}
    </div>
  );
}

/** Welche Ränder der Reihe noch Steine verbergen: davor, dahinter, beides oder keiner. */
type Hidden = 'none' | 'start' | 'end' | 'both';

function hiddenOf(row: HTMLElement): Hidden {
  const before = row.scrollLeft > 1;
  const after = row.scrollLeft + row.clientWidth < row.scrollWidth - 1;
  if (before && after) return 'both';
  if (before) return 'start';
  return after ? 'end' : 'none';
}

/** Verfolgt, ob die Reihe seitwärts weiterrollt; der Rand blendet dann sichtbar aus. */
function useHiddenEdges(ref: RefObject<HTMLElement | null>): Hidden {
  const [hidden, setHidden] = useState<Hidden>('none');
  useEffect(() => {
    const row = ref.current;
    if (row === null) return;
    const update = () => setHidden(hiddenOf(row));
    update();
    row.addEventListener('scroll', update, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(row);
    return () => {
      row.removeEventListener('scroll', update);
      observer?.disconnect();
    };
  }, [ref]);
  return hidden;
}

/** Die Spielsteine der Werft in einer Reihe, die günstigen vorn. */
function YardPieces(props: YardProps): ReactElement {
  const t = useT();
  const ref = useRef<HTMLUListElement>(null);
  const hidden = useHiddenEdges(ref);
  return (
    <ul ref={ref} className="shipyard-pieces" aria-label={t('shipyard')} data-hidden={hidden}>
      {cheapFirst(props.yard.choices).map((choice) => (
        <YardPiece key={choice.unit.id} {...props} choice={choice} />
      ))}
    </ul>
  );
}

/** Rollt die Ansage, bis die Spielsteine ganz über der Leiste des Siegels stehen. */
function revealYard(section: HTMLElement): void {
  revealInPrompt(section, section.querySelector('.shipyard-pieces') ?? section);
}

/**
 * Hält die Werft im sichtbaren Teil der Ansage: beim Erscheinen, wenn die Ansage ihre Höhe
 * ändert und wenn darüber oder darunter Zeilen hinzukommen (`layout`).
 */
function useRevealYard(ref: RefObject<HTMLElement | null>, layout: string): void {
  useEffect(() => {
    const section = ref.current;
    const scroller = section?.closest('.table-prompt');
    if (section == null || !(scroller instanceof HTMLElement)) return;
    revealYard(section);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => revealYard(section));
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [ref, layout]);
}

/** Die Werft mit Titel, Spielsteinen, Dock und dem Planeten neuer Bodentruppen. */
function YardSection({ yard, decision, seat, router }: YardProps): ReactElement {
  const t = useT();
  const id = useId();
  const ref = useRef<HTMLElement>(null);
  useRevealYard(ref, `${String(yard.quote.cost > 0)}|${String(yard.needsGround)}`);
  const style = { '--seat': seatColor(seat) } as CSSProperties;
  return (
    <section
      ref={ref}
      className="shipyard"
      data-testid="shipyard"
      aria-labelledby={id}
      style={style}
    >
      <h3 className="shipyard-title" id={id}>
        {t('production')}
      </h3>
      <YardPieces yard={yard} decision={decision} router={router} seat={seat} />
      <Dock yard={yard} router={router} seat={seat} />
      <GroundLine yard={yard} decision={decision} />
    </section>
  );
}

/** Die Werft der taktischen Produktion bzw. der Kriegsführung (sekundär); sonst nichts. */
export function Shipyard({ game, decision }: PartProps): ReactElement | null {
  const router = useDropRouter(game);
  const yard = shipyardOf(game, decision);
  if (yard === null) return null;
  const seat = seatNumberOf(game, decision.route.actor);
  return <YardSection yard={yard} decision={decision} seat={seat} router={router} />;
}
