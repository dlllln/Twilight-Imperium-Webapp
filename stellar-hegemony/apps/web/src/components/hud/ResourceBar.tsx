import type { GameState } from '@stellar/domain';
import { Coins, Hexagon, type LucideIcon, Package, Star } from 'lucide-react';
import type { ReactElement } from 'react';
import { empireSummary, type Supply, TECHNOLOGY_COLORS } from '../../hud/hud-model.ts';
import type { MessageKey } from '../../i18n.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { useViewer } from '../../game-store.ts';
import { TECH_ICONS } from './tech-icons.ts';

interface StatProps {
  readonly icon: LucideIcon;
  readonly label: MessageKey;
  readonly kind: string;
  readonly value: string;
}

function Stat({ icon: Icon, label, kind, value }: StatProps): ReactElement {
  const t = useT();
  return (
    <li className={`hud-stat ${kind}`} title={t(label)} aria-label={`${t(label)}: ${value}`}>
      <Icon size={17} aria-hidden="true" />
      <span>{value}</span>
    </li>
  );
}

const ofTotal = (supply: Supply): string => `${String(supply.ready)}/${String(supply.total)}`;

/** Kommandotafel als Dreieck: Taktik links, Strategie rechts, Flotte unten in der Mitte. */
function CommandPools({ pools }: { readonly pools: GameState['players'][number]['commandPools'] }) {
  const t = useT();
  return (
    <li className="hud-pools" aria-label={t('commandTokens')}>
      <span className="pool tactic" title={t('tactic')}>
        <small>{t('tactic')}</small>
        {pools.tactic}
      </span>
      <span className="pool fleet" title={t('fleet')}>
        {pools.fleet}
        <small>{t('fleet')}</small>
      </span>
      <span className="pool strategy" title={t('strategy')}>
        <small>{t('strategy')}</small>
        {pools.strategy}
      </span>
    </li>
  );
}

/** Die eigenen Vorräte oben über der Karte: Planetenwerte, Waren, Kommandomarker, Technologien. */
export function ResourceBar({ game }: { readonly game: GameState }): ReactElement | null {
  const player = useViewer();
  const summary = player === null ? null : empireSummary(game, player, content);
  if (summary === null) return null;
  return (
    <ul className="hud-resources glass" data-tutorial="resources">
      <Stat icon={Hexagon} kind="res" label="resources" value={ofTotal(summary.resources)} />
      <Stat icon={Hexagon} kind="inf" label="influence" value={ofTotal(summary.influence)} />
      <Stat icon={Coins} kind="goods" label="tradeGoods" value={String(summary.tradeGoods)} />
      <Stat icon={Package} kind="comm" label="commodities" value={ofTotal(summary.commodities)} />
      <CommandPools pools={summary.pools} />
      {TECHNOLOGY_COLORS.map((color) => (
        <Stat
          key={color}
          icon={TECH_ICONS[color]}
          kind={`tech ${color}`}
          label={color}
          value={String(summary.technologies[color])}
        />
      ))}
      <Stat icon={Star} kind="vp" label="victoryPoints" value={String(summary.victoryPoints)} />
    </ul>
  );
}
