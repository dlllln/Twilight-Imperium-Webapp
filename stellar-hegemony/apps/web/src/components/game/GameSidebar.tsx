import * as Tabs from '@radix-ui/react-tabs';
import type { GameState } from '@stellar/domain';
import { Flag, Layers, type LucideIcon, Trophy, X } from 'lucide-react';
import type { ReactElement, ReactNode } from 'react';
import type { MessageKey } from '../../i18n.ts';
import { useT } from '../../use-translation.ts';
import { LawsPanel } from '../agenda/LawsPanel.tsx';
import { FactionsPanel } from '../faction/FactionsPanel.tsx';
import { ObjectivesPanel } from '../objectives/ObjectivesPanel.tsx';
import { TechnologyPanel } from '../technology/TechnologyPanel.tsx';
import { IconButton } from '../ui/IconButton.tsx';
import { PlayersPanel } from './PlayersPanel.tsx';
import { type SidebarTab, useSidebarStore } from './sidebar-store.ts';
import { StrategyCardGrid } from './StrategyCardGrid.tsx';

const TABS: readonly (readonly [SidebarTab, MessageKey, LucideIcon])[] = [
  ['turn', 'strategyCards', Layers],
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

/** Reiter als Leiste am rechten Kartenrand; ein Reiter öffnet und schließt die Schublade. */
function TabList(): ReactElement {
  const t = useT();
  const toggle = useSidebarStore((state) => state.toggle);
  return (
    <Tabs.List className="tab-list drawer-tabs" aria-label={t('sidebar')}>
      {TABS.map(([value, key, Icon]) => (
        <Tabs.Trigger
          key={value}
          value={value}
          className="tab-trigger"
          onMouseDown={() => toggle(value)}
        >
          <Icon size={18} aria-hidden="true" /> <span>{t(key)}</span>
        </Tabs.Trigger>
      ))}
    </Tabs.List>
  );
}

function DrawerBody({ game, open }: { readonly game: GameState; readonly open: boolean }) {
  const t = useT();
  const close = useSidebarStore((state) => state.close);
  return (
    <div className="drawer-body glass" aria-hidden={!open}>
      <div className="drawer-close">
        <IconButton icon={X} label={t('closeDrawer')} onClick={close} side="bottom" />
      </div>
      <TabPanel value="turn">
        <StrategyCardGrid game={game} />
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
    </div>
  );
}

/** Übersicht als Schublade über der Karte: Kartenauslage, Wertung und das eigene Reich. */
export function GameSidebar({ game }: { readonly game: GameState }): ReactElement {
  const { tab, open } = useSidebarStore();
  const choose = (value: string) => {
    if (isTab(value)) useSidebarStore.getState().setTab(value);
  };
  return (
    <aside className={open ? 'game-drawer open' : 'game-drawer'}>
      <Tabs.Root value={tab} onValueChange={choose} orientation="vertical">
        <TabList />
        <DrawerBody game={game} open={open} />
      </Tabs.Root>
    </aside>
  );
}
