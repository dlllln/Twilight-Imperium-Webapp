import {
  type GameState,
  findPlayer,
  isGroundForce,
  type PlanetId,
  type PlayerId,
  type ProductionChoice,
  type ProductionOrder,
  type ProductionRequest,
  productionChoices,
  productionQuote,
  type SystemId,
  unitTypeId,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { UnitArtwork } from '../../artwork/UnitArtwork.tsx';
import { unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { Actions, PlanetSelect } from './FormParts.tsx';
import { PaymentPicker, usePayment } from './PaymentPicker.tsx';
import { Stepper } from './Stepper.tsx';

export interface ProductionFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly system: SystemId;
  readonly onSubmit: (request: ProductionRequest) => void;
  readonly children?: ReactNode;
}

type Counts = Readonly<Record<string, number>>;

const ordersOf = (counts: Counts): readonly ProductionOrder[] =>
  Object.entries(counts)
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({ type: unitTypeId(type), count }));

const needsGroundPlanet = (orders: readonly ProductionOrder[]): boolean =>
  orders.some((order) => {
    const definition = content.units.find(order.type);
    return definition !== undefined && isGroundForce(definition);
  });

function useProduction(props: ProductionFormProps) {
  const { game, player, system } = props;
  const [counts, setCounts] = useState<Counts>({});
  const orders = ordersOf(counts);
  const quote = productionQuote(game, system, player, orders, content);
  const choices = productionChoices(game, system, player, orders, content);
  const [chosenPlanet, setGroundPlanet] = useState<PlanetId | null>(null);
  const groundPlanet = chosenPlanet ?? quote.groundPlanets[0] ?? null;
  const change = (type: string, delta: number) =>
    setCounts((current) => ({ ...current, [type]: (current[type] ?? 0) + delta }));
  const request = (payment: ProductionRequest['payment']): ProductionRequest => ({
    orders,
    payment,
    groundPlanet: needsGroundPlanet(orders) ? groundPlanet : null,
  });
  return { counts, orders, quote, choices, groundPlanet, setGroundPlanet, change, request };
}

type Production = ReturnType<typeof useProduction>;

function ProductionUnits({
  props,
  form,
}: {
  readonly props: ProductionFormProps;
  readonly form: Production;
}) {
  return (
    <UnitSteppers
      form={form}
      seat={(findPlayer(props.game, props.player)?.seat ?? 0) + 1}
      choices={form.choices}
    />
  );
}

function QuoteLine({ quote }: { readonly quote: Production['quote'] }): ReactElement {
  const t = useT();
  return (
    <>
      <p className="hint">
        {t('productionLimit')}: {quote.count} / {quote.limit} · {t('cost')}:{' '}
        <strong data-testid="production-cost">{quote.cost}</strong>
      </p>
      {quote.blockaded && <p className="warning">{t('blockaded')}</p>}
    </>
  );
}

/** Je baubarer Einheit ein Zähler; ob eine weitere passt (Platz, Vorrat, Blockade), sagt die Domain. */
function UnitSteppers({
  form,
  choices,
  seat,
}: {
  readonly form: Production;
  readonly choices: readonly ProductionChoice[];
  readonly seat: number;
}) {
  const language = useLanguage();
  return choices.map(({ unit, canAdd }) => (
    <div key={unit.id} className="production-unit">
      <UnitArtwork type={unit.id} seat={seat} />
      <Stepper
        label={unitLabel(unit.id, language)}
        value={form.counts[unit.id] ?? 0}
        canAdd={canAdd}
        onChange={(delta) => form.change(unit.id, delta)}
      />
    </div>
  ));
}

/** Ziel neuer Bodentruppen, nur wenn welche bestellt sind. */
function GroundPlanet({ form }: { readonly form: Production }): ReactElement | null {
  const t = useT();
  if (!needsGroundPlanet(form.orders)) return null;
  return (
    <PlanetSelect
      label={t('groundPlanet')}
      options={form.quote.groundPlanets}
      value={form.groundPlanet}
      onChange={form.setGroundPlanet}
    />
  );
}

/**
 * Produktion (RR 62): Einheiten bestellen, mit Ressourcen bezahlen, Bodentruppen platzieren.
 * Produzieren bleibt gesperrt, solange weniger bezahlt ist, als die Einheiten kosten.
 */
export function ProductionForm(props: ProductionFormProps): ReactElement {
  const t = useT();
  const form = useProduction(props);
  const payment = usePayment(props.game, props.player, 'resources');
  const submit = () => props.onSubmit(form.request(payment.payment));
  return (
    <div className="choice-form production-form">
      <h3>{t('production')}</h3>
      <QuoteLine quote={form.quote} />
      <ProductionUnits props={props} form={form} />
      <GroundPlanet form={form} />
      <PaymentPicker
        game={props.game}
        player={props.player}
        currency="resources"
        required={form.quote.cost}
        state={payment}
      />
      <Actions
        label={form.orders.length === 0 ? t('skipProduction') : t('produce')}
        disabled={form.orders.length > 0 && payment.value < form.quote.cost}
        onClick={submit}
      >
        {props.children}
      </Actions>
    </div>
  );
}
