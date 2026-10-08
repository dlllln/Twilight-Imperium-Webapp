import * as Tabs from '@radix-ui/react-tabs';
import { FACTION_NAMES, FACTION_PROFILES, FACTIONS, factionAbilityText } from '@stellar/content';
import { ChevronLeft, Swords } from 'lucide-react';
import type { ReactElement } from 'react';
import { planetImage } from '../../render/images.ts';
import { useSimulatorStore } from '../../simulator/simulator-store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { FactionEmblem } from './FactionEmblem.tsx';

const MAX_COMPLEXITY = 3;

const definitionOf = (id: string) => FACTIONS.find((faction) => faction.id === id);

function FactionList(): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { faction, preview } = useSimulatorStore();
  return (
    <aside className="sim-panel sim-faction-list">
      <h2 className="sim-title">{t('simulator')}</h2>
      <p className="sim-kicker">{t('chooseFaction')}</p>
      <div className="faction-grid" role="radiogroup" aria-label={t('faction')}>
        {FACTIONS.map(({ id }) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={id === faction}
            aria-label={FACTION_NAMES[id]?.[language] ?? id}
            onClick={() => preview(id)}
          >
            <FactionEmblem id={id} size={72} />
          </button>
        ))}
      </div>
    </aside>
  );
}

function Complexity({ level }: { readonly level: number }): ReactElement {
  const t = useT();
  return (
    <p
      className="complexity"
      aria-label={`${t('complexity')} ${String(level)}/${String(MAX_COMPLEXITY)}`}
    >
      <span>{t('complexity')}</span>
      {Array.from({ length: MAX_COMPLEXITY }, (_, index) => (
        <i key={index} className={index < level ? 'on' : ''} />
      ))}
    </p>
  );
}

/** Heimatwelt der Fraktion als großer Planet, davor ihr Wappen. */
function FactionOrb({ id }: { readonly id: string }): ReactElement {
  const home = definitionOf(id)?.homeSystem.planets[0];
  const image = home === undefined ? null : planetImage(home.id, home.trait ?? 'plain');
  return (
    <div className="faction-orb">
      {image !== null && <img src={image} alt="" />}
      <FactionEmblem id={id} size={88} />
    </div>
  );
}

function Summary({ id }: { readonly id: string }): ReactElement {
  const language = useLanguage();
  const abilities = definitionOf(id)?.abilities ?? [];
  return (
    <ul className="ability-list">
      {abilities.map((ability) => {
        const text = factionAbilityText(ability.id);
        return (
          <li key={ability.id}>
            <strong>{text?.name[language] ?? ability.id}</strong>
            <span>{text?.effect[language]}</span>
          </li>
        );
      })}
    </ul>
  );
}

function FactionTabs({ id }: { readonly id: string }): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <Tabs.Root defaultValue="summary" className="faction-tabs">
      <Tabs.List className="pill-tabs" aria-label={t('faction')}>
        <Tabs.Trigger value="summary">{t('summary')}</Tabs.Trigger>
        <Tabs.Trigger value="lore">{t('lore')}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="summary">
        <Summary id={id} />
      </Tabs.Content>
      <Tabs.Content value="lore">
        <p className="faction-lore">{FACTION_PROFILES[id]?.lore[language]}</p>
      </Tabs.Content>
    </Tabs.Root>
  );
}

function FactionDetail(): ReactElement {
  const t = useT();
  const language = useLanguage();
  const { faction, confirmFaction, close } = useSimulatorStore();
  return (
    <div className="sim-faction-detail">
      <header className="faction-head">
        <FactionOrb id={faction} />
        <div>
          <h2>{FACTION_NAMES[faction]?.[language]}</h2>
          <Complexity level={FACTION_PROFILES[faction]?.complexity ?? 1} />
        </div>
      </header>
      <FactionTabs key={faction} id={faction} />
      <footer className="sim-actions">
        <button type="button" className="hex-button" onClick={close}>
          <ChevronLeft size={16} aria-hidden="true" /> {t('back')}
        </button>
        <button type="button" className="hex-button primary" onClick={confirmFaction}>
          <Swords size={16} aria-hidden="true" /> {t('choose')}
        </button>
      </footer>
    </div>
  );
}

/** Erster Schritt des Simulators: Fraktion wählen, links die Liste, rechts die Einzelheiten. */
export function FactionPicker(): ReactElement {
  return (
    <div className="sim-faction">
      <FactionList />
      <FactionDetail />
    </div>
  );
}
