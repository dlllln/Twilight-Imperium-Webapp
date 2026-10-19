import type { GameState } from '@stellar/domain';
import { useGameStore } from '../game-store.ts';
import {
  addCoins,
  ownTradeGoods,
  type PaymentPlan,
  spendableIds,
  togglePlanet,
} from './payment-draft.ts';
import {
  type OpenPayment,
  planFor,
  type Stamp,
  usePaymentStore,
  useStamp,
} from './payment-store.ts';
import { type PlanetSide, type PlanetTable, planetTableOf } from './planet-table.ts';
import { useTableDecision } from './use-table-decision.ts';

/*
 * Die Planeten am Tisch: Spielt die Entscheidung selbst mit Planeten (Führung, Wertung,
 * Diplomatie), gilt ihr Entwurf. Sonst bedient der Tisch das angezeigte Bezahlformular.
 */

function openSide(game: GameState, open: OpenPayment, plan: PaymentPlan): PlanetSide {
  return {
    mode: 'pay',
    currency: open.currency,
    chosen: plan.planets,
    offered: spendableIds(game, open.player, open.currency),
    limit: null,
    tradeGoods: plan.tradeGoods,
    required: open.required,
  };
}

/** Die Planetenreihe zur offenen Bezahlung eines Formulars; sie schreibt in den Store. */
function openTableOf(game: GameState, open: OpenPayment, stamp: Stamp): PlanetTable {
  const side = openSide(game, open, planFor(stamp, open.key, game.version, open.currency));
  const edit = (change: (plan: PaymentPlan) => PaymentPlan) => {
    usePaymentStore.getState().edit(open.key, game.version, open.currency, change);
  };
  return planetTableOf(game, open.player, side, {
    toggle: (planet) => {
      edit((plan) => togglePlanet(plan, planet, side.offered));
    },
    addCoins: (delta) => {
      edit((plan) => addCoins(plan, delta, ownTradeGoods(game, open.player)));
    },
  });
}

/** Die Planeten, die der Tisch gerade anbietet; `null`, wenn keine Entscheidung sie braucht. */
export function usePlanetTable(game: GameState | null): PlanetTable | null {
  const decision = useTableDecision(game);
  const open = usePaymentStore((state) => state.open);
  const me = useGameStore((state) => state.me);
  const stamp = useStamp();
  if (decision?.planets != null) return decision.planets;
  if (game === null || open === null || open.player !== me) return null;
  return openTableOf(game, open, stamp);
}
