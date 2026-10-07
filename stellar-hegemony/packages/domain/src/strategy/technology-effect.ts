import { evaluatePayment, paymentEvents } from '../economy/payment.ts';
import type { GameEvent } from '../game/game-events.ts';
import { type DomainError, domainError, guard } from '../shared/domain-error.ts';
import { andThen, err, map, ok, type Result } from '../shared/result.ts';
import { researchEvents } from '../technology/research.ts';
import type { StrategyCardDefinition } from './strategy-card.ts';
import {
  choiceOf,
  type EffectInput,
  parameterOf,
  type StrategyEffect,
  type TechnologyChoice,
} from './strategy-effect.ts';

type Events = Result<readonly GameEvent[], DomainError>;

/** RR 81.2: eine Technologie frei, höchstens eine weitere gegen Bezahlung. */
const FREE_RESEARCH = 1;
const MAX_RESEARCH = 2;

/** RR 81.2/81.3: Kosten in Ressourcen; Spezialisierungs-Planeten zahlen nicht mit. */
function paid(input: EffectInput, choice: TechnologyChoice, cost: number): Events {
  const { state, player, context } = input;
  const overlap = choice.payment.planets.some((planet) => choice.specialties.includes(planet));
  if (overlap) return err(domainError('technology.specialty', 'Planet doppelt verwendet'));
  if (cost === 0) return ok([]);
  const value = evaluatePayment(state, context.content.tiles, player, choice.payment, 'resources');
  return andThen(value, (amount) =>
    amount < cost
      ? err(domainError('technology.cost', 'Zu wenig Ressourcen', { cost }))
      : ok(paymentEvents(player, choice.payment)),
  );
}

function research(input: EffectInput, choice: TechnologyChoice, cost: number): Events {
  const { state, player, context } = input;
  return andThen(paid(input, choice, cost), (payment) =>
    map(researchEvents(state, player, choice, context.content), (researched) => [
      ...payment,
      ...researched,
    ]),
  );
}

type Ability = 'primary' | 'secondary';

const countCheck = (ability: Ability, count: number) =>
  ability === 'primary'
    ? guard(
        count >= FREE_RESEARCH && count <= MAX_RESEARCH,
        'technology.count',
        'Eine oder zwei Technologien',
      )
    : guard(count === FREE_RESEARCH, 'technology.count', 'Genau eine Technologie');

/**
 * Kosten in Ressourcen für `count` Technologien (RR 81.2/81.3). Information Expert für
 * Domain und Clients: primär ist eine frei, jede weitere kostet `extraResearchCost`;
 * sekundär kostet die eine `secondaryResearchCost`.
 */
export function researchCost(
  card: StrategyCardDefinition,
  ability: Ability,
  count: number,
): Result<number, DomainError> {
  return andThen(countCheck(ability, count), () =>
    ability === 'primary'
      ? map(parameterOf(card, 'extraResearchCost'), (extra) => (count - FREE_RESEARCH) * extra)
      : parameterOf(card, 'secondaryResearchCost'),
  );
}

const resolve =
  (ability: Ability) =>
  (input: EffectInput): Events =>
    andThen(choiceOf(input, 'technology'), (choice) =>
      andThen(researchCost(input.card, ability, choice.technologies.length), (cost) =>
        research(input, choice, cost),
      ),
    );

const primary = resolve('primary');
const secondary = resolve('secondary');

export const technologyEffect: StrategyEffect = { mechanic: 'technology', primary, secondary };
