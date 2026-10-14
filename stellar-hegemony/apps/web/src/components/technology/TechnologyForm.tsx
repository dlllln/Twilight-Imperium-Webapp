import {
  type GameState,
  type Payment,
  type PlanetId,
  type PlayerId,
  researchCost,
  type StrategyCardDefinition,
  type TechnologyChoice,
  type TechnologyColor,
  type TechnologyId,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { technologyArtwork, technologyFrame } from '../../artwork/cards.ts';
import { planetLabel, technologyEffectText, technologyLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { type ResearchOption, researchOptions, specialtyPlanets } from '../../technology-view.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { CardArtwork } from '../cards/CardArtwork.tsx';
import { Actions } from '../game/FormParts.tsx';
import { PaymentPicker, usePayment } from '../game/PaymentPicker.tsx';
import { Prerequisites } from './TechnologyChip.tsx';

export interface TechnologyFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: TechnologyChoice) => void;
  readonly children?: ReactNode;
}

const COLORS: readonly (TechnologyColor | null)[] = [
  'biotic',
  'propulsion',
  'cybernetic',
  'warfare',
  null,
];
const NO_PAYMENT: Payment = { planets: [], tradeGoods: 0 };

const toggled = <T,>(list: readonly T[], item: T): readonly T[] =>
  list.includes(item) ? list.filter((other) => other !== item) : [...list, item];

/** Auswahl, Spezialisierungen und Bezahlung; Anzahl und Kosten entscheidet die Domain. */
function useResearch({ game, player, card, ability, onSubmit }: TechnologyFormProps) {
  const [chosen, setChosen] = useState<readonly TechnologyId[]>([]);
  const [specialties, setSpecialties] = useState<readonly PlanetId[]>([]);
  const payment = usePayment(game, player, 'resources');
  const cost = researchCost(card, ability, chosen.length);
  const required = cost.ok ? cost.value : 0;
  const canAdd = researchCost(card, ability, chosen.length + 1).ok;
  const toggle = (id: TechnologyId) =>
    setChosen((current) => (current.includes(id) || canAdd ? toggled(current, id) : current));
  const submit = () =>
    onSubmit({
      mechanic: 'technology',
      technologies: chosen,
      specialties,
      payment: required === 0 ? NO_PAYMENT : payment.payment,
    });
  const toggleSpecialty = (planet: PlanetId) => setSpecialties((list) => toggled(list, planet));
  return { chosen, specialties, payment, required, canAdd, toggle, toggleSpecialty, submit };
}

type Research = ReturnType<typeof useResearch>;

function OptionRow({
  option,
  form,
}: {
  readonly option: ResearchOption;
  readonly form: Research;
}): ReactElement {
  const language = useLanguage();
  const { technology, missing } = option;
  const checked = form.chosen.includes(technology.id);
  return (
    <label className={`tech-option ti4-print-card${missing.length > 0 ? ' locked' : ''}`}>
      <CardArtwork artwork={technologyFrame(technology.id)} className="ti4-print-frame" />
      <CardArtwork artwork={technologyArtwork(technology.color)} className="ti4-technology-art" />
      <input
        type="checkbox"
        checked={checked}
        disabled={!checked && !form.canAdd}
        onChange={() => form.toggle(technology.id)}
      />
      <span className="tech-name">{technologyLabel(technology.id, language)}</span>
      <Prerequisites technology={technology} missing={missing} />
      <span className="tech-effect">{technologyEffectText(technology.id, language)}</span>
    </label>
  );
}

function OptionGroups(props: TechnologyFormProps & { readonly form: Research }): ReactElement {
  const t = useT();
  const options = researchOptions(props.game, props.player, content, props.form.chosen);
  return (
    <div className="tech-groups">
      {COLORS.map((color) => {
        const group = options.filter((option) => option.technology.color === color);
        if (group.length === 0) return null;
        return (
          <fieldset key={color ?? 'upgrade'} className={`tech-group tech-${color ?? 'upgrade'}`}>
            <legend>{color === null ? t('unitUpgrades') : t(color)}</legend>
            {group.map((option) => (
              <OptionRow key={option.technology.id} option={option} form={props.form} />
            ))}
          </fieldset>
        );
      })}
    </div>
  );
}

function SpecialtyChoices(props: TechnologyFormProps & { readonly form: Research }) {
  const t = useT();
  const language = useLanguage();
  const planets = specialtyPlanets(props.game, props.player, content);
  if (planets.length === 0) return null;
  return (
    <fieldset className="specialties">
      <legend>{t('specialties')}</legend>
      {planets.map(({ planet, color }) => (
        <label key={planet}>
          <input
            type="checkbox"
            checked={props.form.specialties.includes(planet)}
            onChange={() => props.form.toggleSpecialty(planet)}
          />
          {planetLabel(planet, language)}{' '}
          <span className={`tech-dot tech-${color}`} title={t(color)} />
        </label>
      ))}
    </fieldset>
  );
}

/** Technologie (RR 81): wählen, Voraussetzungen ggf. per Spezialisierung, Kosten bezahlen. */
export function TechnologyForm(props: TechnologyFormProps): ReactElement {
  const t = useT();
  const form = useResearch(props);
  return (
    <div className="choice-form technology-form">
      <OptionGroups {...props} form={form} />
      <SpecialtyChoices {...props} form={form} />
      {form.required > 0 && (
        <PaymentPicker
          game={props.game}
          player={props.player}
          currency="resources"
          required={form.required}
          state={form.payment}
        />
      )}
      <Actions label={t('research')} disabled={form.chosen.length === 0} onClick={form.submit}>
        {props.children}
      </Actions>
    </div>
  );
}
