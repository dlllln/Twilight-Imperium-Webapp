import * as Tabs from '@radix-ui/react-tabs';
import { FACTION_NAMES, FACTION_PROFILES, FACTIONS, factionAbilityText } from '@stellar/content';
import type { FactionDefinition } from '@stellar/domain';
import { ChevronLeft, type LucideIcon } from 'lucide-react';
import type { ReactElement } from 'react';
import { planetLabel, technologyLabel, unitLabel } from '../../labels.ts';
import { planetImage } from '../../render/images.ts';
import { seatColor } from '../../seat-colors.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { FactionEmblem } from '../simulator/FactionEmblem.tsx';

const MAX_COMPLEXITY = 3;

const definitionOf = (id: string): FactionDefinition | undefined =>
  FACTIONS.find((faction) => faction.id === id);

/** Was die Auswahl anzeigt und wohin ihre Knöpfe führen; Simulator und Partie teilen sie. */
export interface ChooserProps {
  readonly title: string;
  readonly kicker: string;
  readonly selected: string;
  /** Schon vergebene Fraktionen mit ihrem Platz (1-basiert), z. B. bei mehreren Spielern. */
  readonly taken: Readonly<Record<string, number>>;
  readonly chooseIcon: LucideIcon;
  readonly onPreview: (id: string) => void;
  readonly onChoose: () => void;
  readonly onBack: () => void;
}

function FactionTile({ id, props }: { readonly id: string; readonly props: ChooserProps }) {
  const language = useLanguage();
  const seat = props.taken[id];
  return (
    <button
      type="button"
      role="radio"
      aria-checked={id === props.selected}
      aria-disabled={seat !== undefined}
      aria-label={FACTION_NAMES[id]?.[language] ?? id}
      className={seat === undefined ? undefined : 'taken'}
      onClick={() => props.onPreview(id)}
    >
      <FactionEmblem id={id} size={72} />
      {seat !== undefined && (
        <span className="seat-badge" style={{ background: seatColor(seat) }}>
          P{seat}
        </span>
      )}
    </button>
  );
}

function FactionList(props: ChooserProps): ReactElement {
  const t = useT();
  return (
    <aside className="sim-panel sim-faction-list">
      <h2 className="sim-title">{props.title}</h2>
      <p className="sim-kicker">{props.kicker}</p>
      <div className="faction-grid" role="radiogroup" aria-label={t('faction')}>
        {FACTIONS.map(({ id }) => (
          <FactionTile key={id} id={id} props={props} />
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

/** Heimatplaneten mit Ressourcen und Einfluss, Startflotte und Starttechnologien. */
function Details({ faction }: { readonly faction: FactionDefinition }): ReactElement {
  const t = useT();
  const language = useLanguage();
  const units = [
    ...faction.startingForces.space,
    ...faction.startingForces.planets.flatMap((p) => p.units),
  ];
  return (
    <dl className="faction-details">
      <dt>{t('homeWorlds')}</dt>
      {faction.homeSystem.planets.map((planet) => (
        <dd key={planet.id}>
          {planetLabel(planet.id, language)} <b className="res">{planet.resources}</b>{' '}
          <b className="inf">{planet.influence}</b>
        </dd>
      ))}
      <dt>{t('startingFleet')}</dt>
      {units.map((stack, index) => (
        <dd key={`${stack.type}-${String(index)}`}>
          {stack.count} × {unitLabel(stack.type, language)}
        </dd>
      ))}
      <dt>{t('startingTech')}</dt>
      {faction.startingTechnologies.map((tech) => (
        <dd key={tech}>{technologyLabel(tech, language)}</dd>
      ))}
    </dl>
  );
}

function FactionTabs({ id }: { readonly id: string }): ReactElement {
  const t = useT();
  const language = useLanguage();
  const faction = definitionOf(id);
  return (
    <Tabs.Root defaultValue="summary" className="faction-tabs">
      <Tabs.List className="pill-tabs" aria-label={t('faction')}>
        <Tabs.Trigger value="summary">{t('summary')}</Tabs.Trigger>
        <Tabs.Trigger value="details">{t('details')}</Tabs.Trigger>
        <Tabs.Trigger value="lore">{t('lore')}</Tabs.Trigger>
      </Tabs.List>
      <Tabs.Content value="summary">
        <Summary id={id} />
      </Tabs.Content>
      <Tabs.Content value="details">
        {faction !== undefined && <Details faction={faction} />}
      </Tabs.Content>
      <Tabs.Content value="lore">
        <p className="faction-lore">{FACTION_PROFILES[id]?.lore[language]}</p>
      </Tabs.Content>
    </Tabs.Root>
  );
}

function FactionHead({ id }: { readonly id: string }): ReactElement {
  const t = useT();
  const language = useLanguage();
  return (
    <header className="faction-head">
      <FactionOrb id={id} />
      <div>
        <h2>{FACTION_NAMES[id]?.[language]}</h2>
        <Complexity level={FACTION_PROFILES[id]?.complexity ?? 1} />
        <p className="faction-commodities">
          {t('commodities')} <b>{definitionOf(id)?.commodityLimit ?? 0}</b>
        </p>
      </div>
    </header>
  );
}

function FactionDetail(props: ChooserProps): ReactElement {
  const t = useT();
  const { selected, chooseIcon: ChooseIcon } = props;
  return (
    <div className="sim-faction-detail">
      <FactionHead id={selected} />
      <FactionTabs key={selected} id={selected} />
      <footer className="sim-actions">
        <button type="button" className="hex-button" onClick={props.onBack}>
          <ChevronLeft size={16} aria-hidden="true" /> {t('back')}
        </button>
        <button
          type="button"
          className="hex-button primary"
          disabled={props.taken[selected] !== undefined}
          onClick={props.onChoose}
        >
          <ChooseIcon size={16} aria-hidden="true" /> {t('choose')}
        </button>
      </footer>
    </div>
  );
}

/** Fraktion wählen: links die Wappen, rechts Name, Komplexität, Reiter und Fähigkeiten. */
export function FactionChooser(props: ChooserProps): ReactElement {
  return (
    <div className="sim-faction">
      <FactionList {...props} />
      <FactionDetail {...props} />
    </div>
  );
}
