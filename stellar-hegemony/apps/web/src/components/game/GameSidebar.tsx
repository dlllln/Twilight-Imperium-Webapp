import * as Tabs from '@radix-ui/react-tabs';
import type { GameState } from '@stellar/domain';
import { Compass, Flag, type LucideIcon, Trophy } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import { useGameStore } from '../../game-store.ts';
import { errorText, type MessageKey } from '../../i18n.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { LawsPanel } from '../agenda/LawsPanel.tsx';
import { HandPanel } from '../cards/HandPanel.tsx';
import { FactionsPanel } from '../faction/FactionsPanel.tsx';
import { ObjectivesPanel } from '../objectives/ObjectivesPanel.tsx';
import { TechnologyPanel } from '../technology/TechnologyPanel.tsx';
import { PlayersPanel } from './PlayersPanel.tsx';
import { type SidebarTab, useSidebarStore } from './sidebar-store.ts';
import { StrategyCardGrid } from './StrategyCardGrid.tsx';
import { TurnPanel } from './TurnPanel.tsx';

const TABS: readonly (readonly [SidebarTab, MessageKey, LucideIcon])[] = [
  ['turn', 'tabTurn', Compass],
  ['score', 'tabScore', Trophy],
  ['empire', 'tabEmpire', Flag],
];

const isTab = (value: string): value is SidebarTab => TABS.some(([tab]) => tab === value);

/** Inhalt eines Reiters; bleibt im DOM, damit Formulare beim Wechseln ihren Stand behalten. */
function TabPanel({
  value,
  children,
}: {
  readonly value: SidebarTab;
  readonly children: ReactNode;
}) {
  return (
    <Tabs.Content value={value} forceMount className="tab-panel">
      {children}
    </Tabs.Content>
  );
}

function RuleError(): ReactElement | null {
  const t = useT();
  const language = useLanguage();
  const error = useGameStore((state) => state.error);
  if (error === null) return null;
  return (
    <p className="error" role="alert">
      {t('ruleError')}: {errorText(language, error.code)}
    </p>
  );
}

function TabList(): ReactElement {
  const t = useT();
  return (
    <Tabs.List className="tab-list" aria-label={t('sidebar')}>
      {TABS.map(([value, key, Icon]) => (
        <Tabs.Trigger key={value} value={value} className="tab-trigger">
          <Icon size={16} aria-hidden="true" /> {t(key)}
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}

/** Seitenleiste mit drei Reitern statt aller Abschnitte untereinander. */
export function GameSidebar({ game }: { readonly game: GameState }): ReactElement {
  const { tab, setTab } = useSidebarStore();
  const choose = (value: string) => {
    if (isTab(value)) setTab(value);
  };
  return (
    <aside className="game-sidebar glass">
      <RuleError />
      <Tabs.Root value={tab} onValueChange={choose}>
        <TabList />
        <TabPanel value="turn">
          <TurnPanel game={game} />
          <StrategyCardGrid game={game} />
          <HandPanel game={game} />
        </TabPanel>
        <TabPanel value="score">
          <ObjectivesPanel game={game} />
          <PlayersPanel game={game} />
        </TabPanel>
        <TabPanel value="empire">
          <TechnologyPanel game={game} />
          <FactionsPanel game={game} />
          <LawsPanel game={game} />
        </TabPanel>
      </Tabs.Root>
    </aside>
  );
}
