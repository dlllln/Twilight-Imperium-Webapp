import type { GameState } from '@stellar/domain';
import { Coins, Hexagon, Package, Star } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { ReactElement } from 'react';
import { useViewer } from '../../game-store.ts';
import { type EmpireSummary, type Supply, TECHNOLOGY_COLORS } from '../../hud/hud-model.ts';
import { PILE_MAX, type SheetModel, supplyText } from '../../hud/sheet-model.ts';
import type { SheetPulse, SheetTable } from '../../hud/use-sheet.ts';
import type { MessageKey } from '../../i18n.ts';
import { CRATE_PIECE, GOODS_PIECE } from '../../table/target-ref.ts';
import { usePlanetTable } from '../../table/use-planet-table.ts';
import { useTarget } from '../../table/use-target.ts';
import { useOfferedGoods } from '../../table/use-trade-mat.ts';
import { useT } from '../../use-translation.ts';
import { TECH_ICONS } from '../hud/tech-icons.ts';
import { CoinPiece } from './KassePlate.tsx';
import { dropAttributes } from './SheetPiece.tsx';
import { Coin, Crate, SheetDelta, Socket } from './SheetTokens.tsx';

/** Umfang des Siegpunktrings (Radius 17 im 40er-Raster). */
const RING = 2 * Math.PI * 17;

interface GoodsProps {
  readonly count: number;
  /** Münzen, die gerade in der Kasse liegen; sie fehlen auf dem Haufen. */
  readonly inKasse: number;
  /** Münzen auf der Handelsmatte; auch sie fehlen auf dem Haufen. */
  readonly offered: number;
  readonly pulse: SheetPulse;
  readonly table: SheetTable;
}

/** Der Münzhaufen; während einer Bezahlung liegt obenauf eine Münze zum Aufnehmen. */
function Pile({ count, table }: Pick<GoodsProps, 'count' | 'table'>): ReactElement {
  const t = useT();
  return (
    <div className="sheet-pile">
      <AnimatePresence initial={false}>
        {Array.from({ length: Math.min(count, PILE_MAX) }, (_, index) => (
          <Coin key={index} index={index} />
        ))}
      </AnimatePresence>
      <CoinPiece piece={GOODS_PIECE} label={t('pickUpCoin')} table={table} />
    </div>
  );
}

/** „Handelswaren: 4“, während einer Bezahlung „Handelswaren: 4 (3 in der Kasse)“. */
function goodsText(t: (key: MessageKey) => string, count: number, inKasse: number): string {
  const total = `${t('tradeGoods')}: ${String(count)}`;
  return inKasse > 0 ? `${total} (${t('inKasse').replace('{count}', String(inKasse))})` : total;
}

/**
 * Haufen goldener Münzen für die Handelswaren; ab zehn wächst nur noch die Zahl. Der Haufen ist
 * auch ein Ziel: Münzen aus der Kasse kommen hierher zurück. Münzen in der Kasse oder auf der
 * Handelsmatte liegen nicht mehr auf dem Haufen; die Beschriftung nennt weiter den ganzen Vorrat.
 */
function Goods({ count, inKasse, offered, pulse, table }: GoodsProps): ReactElement {
  const t = useT();
  const target = useTarget(GOODS_PIECE, undefined, table.router);
  const left = Math.max(0, count - inKasse - offered);
  const text = goodsText(t, count, inKasse);
  return (
    <div
      className="sheet-goods"
      aria-label={text}
      title={text}
      {...target.props}
      {...dropAttributes(target)}
      data-over={target.over ? 'true' : undefined}
    >
      <Pile count={left} table={table} />
      <span className="sheet-count" data-testid="goods-count">
        <Coins className="sheet-icon" size={12} aria-hidden="true" />
        {left}
      </span>
      <span className="sheet-caption" aria-hidden="true">
        {t('tradeGoods')}
      </span>
      <SheetDelta zone="tradeGoods" pulse={pulse} />
    </div>
  );
}

/** Eine Fassung; auf der obersten vollen liegt, solange gehandelt wird, die Kiste zum Aufnehmen. */
function CrateSlot(props: {
  readonly filled: boolean;
  readonly top: boolean;
  readonly table: SheetTable;
}) {
  const t = useT();
  return (
    <Socket>
      <AnimatePresence initial={false}>{props.filled && <Crate key="crate" />}</AnimatePresence>
      {props.top && (
        <CoinPiece piece={CRATE_PIECE} label={t('pickUpCrate')} table={props.table} look="crate" />
      )}
    </Socket>
  );
}

interface CommoditiesProps {
  readonly supply: Supply;
  /** Kisten auf der Handelsmatte; ihre Fassungen sind leer, die Beschriftung zählt sie mit. */
  readonly offered: number;
  readonly pulse: SheetPulse;
  readonly table: SheetTable;
}

/** Genau so viele Fassungen wie das Rohstofflimit; jede volle trägt eine Kiste. */
function Commodities({ supply, offered, pulse, table }: CommoditiesProps) {
  const t = useT();
  const left = Math.max(0, supply.ready - offered);
  return (
    <div
      className="sheet-commodities"
      aria-label={`${t('commodities')}: ${supplyText(supply)}`}
      title={t('commodities')}
    >
      <div className="sheet-crates">
        <Package className="sheet-icon" size={12} aria-hidden="true" />
        {Array.from({ length: supply.total }, (_, index) => (
          <CrateSlot key={index} filled={index < left} top={index === left - 1} table={table} />
        ))}
      </div>
      <span className="sheet-caption" aria-hidden="true">
        {t('commodities')}
      </span>
      <SheetDelta zone="commodities" pulse={pulse} />
    </div>
  );
}

interface PlateProps {
  readonly kind: 'res' | 'inf';
  readonly label: MessageKey;
  readonly supply: Supply;
}

/** Plakette mit bereiten und gesamten Planetenwerten. */
function ValuePlate({ kind, label, supply }: PlateProps): ReactElement {
  const t = useT();
  return (
    <span
      className={`sheet-value ${kind}`}
      aria-label={`${t(label)}: ${supplyText(supply)}`}
      title={t(label)}
    >
      <Hexagon size={14} aria-hidden="true" />
      <b>{supply.ready}</b>
      <small>/{supply.total}</small>
    </span>
  );
}

/** Vier Lampen, eine je Technologiefarbe; sie leuchten, sobald eine Technologie da ist. */
function TechLamps({ technologies }: { readonly technologies: EmpireSummary['technologies'] }) {
  const t = useT();
  return (
    <div className="sheet-techs">
      {TECHNOLOGY_COLORS.map((color) => {
        const Icon = TECH_ICONS[color];
        const count = technologies[color];
        return (
          <span
            key={color}
            className={`sheet-tech ${color}`}
            data-lit={count > 0 ? '' : undefined}
            aria-label={`${t(color)}: ${String(count)}`}
            title={t(color)}
          >
            <Icon size={13} aria-hidden="true" />
            <b>{count}</b>
          </span>
        );
      })}
    </div>
  );
}

interface VictoryProps {
  readonly points: number;
  readonly goal: number;
  readonly pulse: SheetPulse;
}

/** Siegpunkt-Medaillon: der Ring füllt sich bis zum Ziel. */
function VictoryPlate({ points, goal, pulse }: VictoryProps): ReactElement {
  const t = useT();
  const share = goal > 0 ? Math.min(1, points / goal) : 0;
  return (
    <div
      className="sheet-vp"
      aria-label={`${t('victoryPoints')}: ${String(points)}/${String(goal)}`}
      title={t('victoryPoints')}
    >
      <svg className="sheet-vp-ring" viewBox="0 0 40 40" aria-hidden="true">
        <circle className="vp-track" cx="20" cy="20" r="17" />
        <circle
          className="vp-progress"
          cx="20"
          cy="20"
          r="17"
          strokeDasharray={`${(RING * share).toFixed(2)} ${RING.toFixed(2)}`}
          transform="rotate(-90 20 20)"
        />
      </svg>
      <Star className="sheet-vp-star" size={11} aria-hidden="true" />
      <span className="sheet-vp-value">
        <b>{points}</b>
        <small>/{goal}</small>
      </span>
      <SheetDelta zone="victoryPoints" pulse={pulse} />
    </div>
  );
}

interface WingProps {
  readonly game: GameState;
  readonly model: SheetModel;
  readonly pulse: SheetPulse;
  readonly table: SheetTable;
}

/** Münzen in der Kasse der eigenen offenen Bezahlung; sonst keine. */
function useCoinsInKasse(game: GameState): number {
  const viewer = useViewer();
  const planets = usePlanetTable(game);
  if (planets === null || planets.mode !== 'pay' || planets.player !== viewer) return 0;
  return planets.tradeGoods ?? 0;
}

/** Rechter Flügel: Münzen, Rohstoffkisten, Planetenwerte, Technologielampen, Siegpunkte. */
export function TreasuryWing({ game, model, pulse, table }: WingProps): ReactElement {
  const t = useT();
  const { summary } = model;
  const inKasse = useCoinsInKasse(game);
  const offered = useOfferedGoods(game, model.player);
  const goods = { inKasse, offered: offered.tradeGoods, pulse, table };
  return (
    <div className="sheet-wing treasury" role="group" aria-label={t('sheetTreasury')}>
      <Goods count={summary.tradeGoods} {...goods} />
      <Commodities
        supply={summary.commodities}
        offered={offered.commodities}
        pulse={pulse}
        table={table}
      />
      <div className="sheet-values">
        <ValuePlate kind="res" label="resources" supply={summary.resources} />
        <ValuePlate kind="inf" label="influence" supply={summary.influence} />
      </div>
      <TechLamps technologies={summary.technologies} />
      <VictoryPlate points={summary.victoryPoints} goal={model.victoryGoal} pulse={pulse} />
    </div>
  );
}
