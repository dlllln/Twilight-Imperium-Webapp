import {
  type GameState,
  isGroundForce,
  type PlanetId,
  type PlayerId,
  type ProductionOrder,
  type ProductionRequest,
  producibleUnits,
  productionQuote,
  type SystemId,
  type UnitDefinition,
  unitTypeId,
} from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { unitLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { unitsOf } from '../../unit-stats.ts';
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
  const [chosenPlanet, setGroundPlanet] = useState<PlanetId | null>(null);
  const groundPlanet = chosenPlanet ?? quote.groundPlanets[0] ?? null;
  const change = (type: string, delta: number) =>
    setCounts((current) => ({ ...current, [type]: (current[type] ?? 0) + delta }));
  const request = (payment: ProductionRequest['payment']): ProductionRequest => ({
    orders,
    payment,
    groundPlanet: needsGroundPlanet(orders) ? groundPlanet : null,
  });
  return { counts, orders, quote, groundPlanet, setGroundPlanet, change, request };
}

type Production = ReturnType<typeof useProduction>;

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

function UnitSteppers({
  form,
  units,
}: {
  readonly form: Production;
  readonly units: readonly UnitDefinition[];
}) {
  const language = useLanguage();
  const room = form.quote.count < form.quote.limit;
  return units.map((unit) => (
    <Stepper
      key={unit.id}
      label={unitLabel(unit.id, language)}
      value={form.counts[unit.id] ?? 0}
      canAdd={room}
      onChange={(delta) => form.change(unit.id, delta)}
    />
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

/** Produktion (RR 62): Einheiten bestellen, mit Ressourcen bezahlen, Bodentruppen platzieren. */
export function ProductionForm(props: ProductionFormProps): ReactElement {
  const t = useT();
  const form = useProduction(props);
  const payment = usePayment(props.game, props.player, 'resources');
  const submit = () => props.onSubmit(form.request(payment.payment));
  return (
    <div className="choice-form production-form">
      <h3>{t('production')}</h3>
      <QuoteLine quote={form.quote} />
      <UnitSteppers
        form={form}
        units={producibleUnits(props.game, props.player, unitsOf(props.game))}
      />
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
        onClick={submit}
      >
        {props.children}
      </Actions>
    </div>
  );
}
