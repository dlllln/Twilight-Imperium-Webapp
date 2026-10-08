import { FACTIONS } from '@stellar/content';
import type {
  BattleOutcome,
  FleetOrder,
  SimBattle,
  SimRoundReport,
  UnitTypeId,
} from '@stellar/domain';
import { create } from 'zustand';
import { AFTERGLOW_MS, roundDuration, type Shot, shotsOf } from '../battle/battle-shots.ts';
import { useSettingsStore } from '../settings-store.ts';
import { battleSeed, catalogFor, newBattle, playRound, seriesScore } from './simulator-rules.ts';

/** Abschnitte des Simulators wie im Ablauf: Fraktion, Flotte, Kampf. */
export type SimulatorStage = 'closed' | 'faction' | 'fleet' | 'battle';

export interface SimulatorState {
  readonly stage: SimulatorStage;
  readonly faction: string;
  readonly rival: string;
  readonly order: FleetOrder;
  /** Stand nach der letzten Runde. */
  readonly battle: SimBattle | null;
  /** Stand, den die Bühne zeigt; hinkt während der Schüsse hinterher. */
  readonly shown: SimBattle | null;
  readonly report: SimRoundReport | null;
  readonly shots: readonly Shot[];
  readonly volley: number;
  readonly card: string | null;
  readonly results: readonly BattleOutcome[];
  readonly seed: number;
}

interface SimulatorActions {
  readonly open: () => void;
  readonly close: () => void;
  readonly preview: (faction: string) => void;
  readonly confirmFaction: () => void;
  readonly back: () => void;
  readonly setCount: (type: UnitTypeId, count: number) => void;
  readonly launch: () => void;
  readonly pickCard: (card: string | null) => void;
  readonly fire: () => void;
  readonly settle: () => void;
  readonly nextBattle: () => void;
}

const firstFaction = (): string => FACTIONS[0]?.id ?? '';

const initial = (): SimulatorState => ({
  stage: 'closed',
  faction: firstFaction(),
  rival: firstFaction(),
  order: {},
  battle: null,
  shown: null,
  report: null,
  shots: [],
  volley: 0,
  card: null,
  results: [],
  seed: Date.now(),
});

/** Der Gegner bekommt eine andere Fraktion, je nach Startwert. */
function rivalOf(faction: string, seed: number): string {
  const others = FACTIONS.filter((candidate) => candidate.id !== faction);
  return others[seed % Math.max(1, others.length)]?.id ?? faction;
}

const targetsIn = (battle: SimBattle) => (player: string) =>
  [battle.attacker, battle.defender]
    .find((side) => side.player === player)
    ?.units.map((unit) => unit.id) ?? [];

type Set = (partial: Partial<SimulatorState>) => void;
type Get = () => SimulatorState & SimulatorActions;

function fire(set: Set, get: Get): void {
  const { battle, card, faction, rival, results, seed } = get();
  if (battle === null || battle.outcome !== null) return;
  const outcome = playRound(
    battle,
    card,
    catalogFor(faction, rival),
    battleSeed(seed, results.length),
  );
  if (!outcome.ok) return;
  const shots = shotsOf(outcome.value.report, targetsIn(battle));
  set({ battle: outcome.value.battle, report: outcome.value.report, shots, card: null });
  set({ volley: get().volley + 1 });
  const wait = useSettingsStore.getState().animations ? roundDuration(shots, AFTERGLOW_MS) : 0;
  if (wait === 0) get().settle();
  else setTimeout(() => get().settle(), wait);
}

function settle(set: Set, get: Get): void {
  const { battle, results } = get();
  if (battle === null) return;
  const done = battle.outcome !== null && get().shown !== battle;
  set({ shown: battle, results: done ? [...results, battle.outcome] : results });
}

function launch(set: Set, get: Get): void {
  const { order, faction, rival, seed, results } = get();
  const battle = newBattle(order, catalogFor(faction, rival), battleSeed(seed, results.length));
  set({ stage: 'battle', battle, shown: battle, report: null, shots: [], card: null });
}

/** Zustand des Kampfsimulators (Controller nach GRASP): Abläufe hier, Regeln in der Domain. */
export const useSimulatorStore = create<SimulatorState & SimulatorActions>((set, get) => ({
  ...initial(),
  open: () => set({ ...initial(), stage: 'faction' }),
  close: () => set({ stage: 'closed', battle: null, shown: null }),
  preview: (faction) => set({ faction }),
  confirmFaction: () => set({ stage: 'fleet', rival: rivalOf(get().faction, get().seed) }),
  back: () => set({ stage: get().stage === 'fleet' ? 'faction' : 'fleet' }),
  setCount: (type, count) => set({ order: { ...get().order, [type]: Math.max(0, count) } }),
  launch: () => launch(set, get),
  pickCard: (card) => set({ card: get().card === card ? null : card }),
  fire: () => fire(set, get),
  settle: () => settle(set, get),
  nextBattle: () => {
    if (seriesScore(get().results).over) get().open();
    else set({ stage: 'fleet' });
  },
}));
