import {
  type GameState,
  type Payment,
  type PlanetId,
  type PlayerId,
  type ResearchOption,
  researchCost,
  researchOptions,
  type StrategyCardDefinition,
  type TechnologyChoice,
  type TechnologyColor,
  type TechnologyDefinition,
  type TechnologyId,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { technologyArtwork, technologyFrame } from '../../artwork/cards.ts';
import { planetLabel, technologyEffectText, technologyLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { RESEARCH_COLUMNS } from '../../table/spec-research.ts';
import { specialtyPlanets } from '../../technology-view.ts';
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

const NO_PAYMENT: Payment = { planets: [], tradeGoods: 0 };

const toggled = <T,>(list: readonly T[], item: T): readonly T[] =>
  list.includes(item) ? list.filter((other) => other !== item) : [...list, item];

/**
 * Auswahl und Spezialisierungen. Was einer Technologie noch fehlt, sagt die Domain samt der
 * gewählten Spezialisierungen; gesperrte Technologien kommen nicht dazu (behebt A2).
 */
function useChoice(props: TechnologyFormProps) {
  const [chosen, setChosen] = useState<readonly TechnologyId[]>([]);
  const [specialties, setSpecialties] = useState<readonly PlanetId[]>([]);
  const canAdd = researchCost(props.card, props.ability, chosen.length + 1).ok;
  const request = { technologies: chosen, specialties };
  const options = researchOptions(props.game, props.player, content, request);
  const open = (id: TechnologyId) =>
    canAdd && options.some((option) => option.technology.id === id && option.missing.length === 0);
  const toggle = (id: TechnologyId) =>
    setChosen((current) => (current.includes(id) || open(id) ? toggled(current, id) : current));
  const toggleSpecialty = (planet: PlanetId) => setSpecialties((list) => toggled(list, planet));
  return { chosen, specialties, options, canAdd, toggle, toggleSpecialty };
}

/** Auswahl, Spezialisierungen und Bezahlung; Anzahl und Kosten entscheidet die Domain. */
function useResearch(props: TechnologyFormProps) {
  const { game, player, card, ability, onSubmit } = props;
  const payment = usePayment(game, player, 'resources');
  const choice = useChoice(props);
  const cost = researchCost(card, ability, choice.chosen.length);
  const required = cost.ok ? cost.value : 0;
  const submit = () =>
    onSubmit({
      mechanic: 'technology',
      technologies: choice.chosen,
      specialties: choice.specialties,
      payment: required === 0 ? NO_PAYMENT : payment.payment,
    });
  const unpaid = required > 0 && payment.value < required;
  return { ...choice, payment, required, unpaid, submit };
}

type Research = ReturnType<typeof useResearch>;

export interface ResearchCardFaceProps {
  readonly technology: TechnologyDefinition;
  readonly missing: readonly TechnologyColor[];
}

/**
 * Das Gesicht einer Technologiekarte für Formular und Forschungsauslage: Rahmen, Bild der
 * Farbe, Name, Voraussetzungen (fehlende hohl) und Wirkung. Liegt direkt im Etikett der Karte.
 */
export function ResearchCardFace({ technology, missing }: ResearchCardFaceProps): ReactElement {
  const language = useLanguage();
  return (
    <>
      <CardArtwork artwork={technologyFrame(technology.id)} className="ti4-print-frame" />
      <CardArtwork artwork={technologyArtwork(technology.color)} className="ti4-technology-art" />
      <span className="tech-name">{technologyLabel(technology.id, language)}</span>
      <Prerequisites technology={technology} missing={missing} />
      <span className="tech-effect">{technologyEffectText(technology.id, language)}</span>
    </>
  );
}

/** Eine Technologie im Formular; gesperrte und überzählige lassen sich nicht ankreuzen. */
function OptionRow(props: { readonly option: ResearchOption; readonly form: Research }) {
  const { technology, missing } = props.option;
  const { form } = props;
  const checked = form.chosen.includes(technology.id);
  const locked = missing.length > 0;
  return (
    <label className={`tech-option ti4-print-card${locked ? ' locked' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={!checked && (locked || !form.canAdd)}
        onChange={() => form.toggle(technology.id)}
      />
      <ResearchCardFace technology={technology} missing={missing} />
    </label>
  );
}

function OptionGroups({ form }: { readonly form: Research }): ReactElement {
  const t = useT();
  return (
    <div className="tech-groups">
      {RESEARCH_COLUMNS.map((color) => {
        const group = form.options.filter((option) => option.technology.color === color);
        if (group.length === 0) return null;
        return (
          <fieldset key={color ?? 'upgrade'} className={`tech-group tech-${color ?? 'upgrade'}`}>
            <legend>{color === null ? t('unitUpgrades') : t(color)}</legend>
            {group.map((option) => (
              <OptionRow key={option.technology.id} option={option} form={form} />
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

/**
 * Technologie (RR 81): wählen, Voraussetzungen ggf. per Spezialisierung, Kosten bezahlen.
 * Erforschen bleibt gesperrt, solange zu wenig bezahlt ist.
 */
export function TechnologyForm(props: TechnologyFormProps): ReactElement {
  const t = useT();
  const form = useResearch(props);
  return (
    <div className="choice-form technology-form">
      <OptionGroups form={form} />
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
      <Actions
        label={t('research')}
        disabled={form.chosen.length === 0 || form.unpaid}
        onClick={form.submit}
      >
        {props.children}
      </Actions>
    </div>
  );
}
