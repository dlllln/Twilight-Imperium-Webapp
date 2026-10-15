import { Coins, Hexagon, Package, Star } from 'lucide-react';
import { AnimatePresence } from 'motion/react';
import type { ReactElement } from 'react';
import { type EmpireSummary, type Supply, TECHNOLOGY_COLORS } from '../../hud/hud-model.ts';
import { PILE_MAX, type SheetModel, supplyText } from '../../hud/sheet-model.ts';
import type { SheetPulse } from '../../hud/use-sheet.ts';
import type { MessageKey } from '../../i18n.ts';
import { useT } from '../../use-translation.ts';
import { TECH_ICONS } from '../hud/tech-icons.ts';
import { Coin, CrateSocket, SheetDelta } from './SheetTokens.tsx';

/** Umfang des Siegpunktrings (Radius 17 im 40er-Raster). */
const RING = 2 * Math.PI * 17;

/** Haufen goldener Münzen für die Handelswaren; ab zehn wächst nur noch die Zahl. */
function Goods({ count, pulse }: { readonly count: number; readonly pulse: SheetPulse }) {
  const t = useT();
  return (
    <div
      className="sheet-goods"
      aria-label={`${t('tradeGoods')}: ${String(count)}`}
      title={t('tradeGoods')}
    >
      <div className="sheet-pile">
        <AnimatePresence initial={false}>
          {Array.from({ length: Math.min(count, PILE_MAX) }, (_, index) => (
            <Coin key={index} index={index} />
          ))}
        </AnimatePresence>
      </div>
      <span className="sheet-count">
        <Coins className="sheet-icon" size={12} aria-hidden="true" />
        {count}
      </span>
      <span className="sheet-caption" aria-hidden="true">
        {t('tradeGoods')}
      </span>
      <SheetDelta zone="tradeGoods" pulse={pulse} />
    </div>
  );
}

/** Genau so viele Fassungen wie das Rohstofflimit; jede volle trägt eine Kiste. */
function Commodities({ supply, pulse }: { readonly supply: Supply; readonly pulse: SheetPulse }) {
  const t = useT();
  return (
    <div
      className="sheet-commodities"
      aria-label={`${t('commodities')}: ${supplyText(supply)}`}
      title={t('commodities')}
    >
      <div className="sheet-crates">
        <Package className="sheet-icon" size={12} aria-hidden="true" />
        {Array.from({ length: supply.total }, (_, index) => (
          <CrateSocket key={index} filled={index < supply.ready} />
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

/** Rechter Flügel: Münzen, Rohstoffkisten, Planetenwerte, Technologielampen, Siegpunkte. */
export function TreasuryWing({
  model,
  pulse,
}: {
  readonly model: SheetModel;
  readonly pulse: SheetPulse;
}): ReactElement {
  const t = useT();
  const { summary } = model;
  return (
    <div className="sheet-wing treasury" role="group" aria-label={t('sheetTreasury')}>
      <Goods count={summary.tradeGoods} pulse={pulse} />
      <Commodities supply={summary.commodities} pulse={pulse} />
      <div className="sheet-values">
        <ValuePlate kind="res" label="resources" supply={summary.resources} />
        <ValuePlate kind="inf" label="influence" supply={summary.influence} />
      </div>
      <TechLamps technologies={summary.technologies} />
      <VictoryPlate points={summary.victoryPoints} goal={model.victoryGoal} pulse={pulse} />
    </div>
  );
}
