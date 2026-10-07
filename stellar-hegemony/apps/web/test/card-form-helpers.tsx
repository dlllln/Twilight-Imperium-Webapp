import { type GameState, type PlayerId, type StrategyCardDefinition } from '@stellar/domain';
import type { ReactElement } from 'react';
import { homeSystemOf } from '../src/card-view.ts';
import { ChoiceForm } from '../src/components/game/ChoiceForm.tsx';
import { useGameStore } from '../src/game-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import { pickAll, started } from './game-helpers.ts';

export const cardOf = (mechanic: StrategyCardDefinition['mechanic']) =>
  content.strategyCards.find((card) => card.mechanic === mechanic) as StrategyCardDefinition;

/** Der aktive Spieler bekommt die Karte zusätzlich; optional liegt ein Marker in seiner Heimat. */
export function holding(mechanic: StrategyCardDefinition['mechanic'], tokenAtHome = false) {
  useGalaxyStore.setState({ language: 'de' });
  const state = pickAll(started());
  const player = state.actionPhase?.active as PlayerId;
  const card = cardOf(mechanic);
  const held = { ...state.strategyCards[card.id], holder: player, exhausted: false };
  const home = homeSystemOf(state, player, content) as string;
  const system = state.systems[home] as GameState['systems'][string];
  const systems = tokenAtHome
    ? { ...state.systems, [home]: { ...system, commandTokens: [player] } }
    : state.systems;
  useGameStore.setState({
    game: { ...state, systems, strategyCards: { ...state.strategyCards, [card.id]: held } },
  } as never);
  return { player, card, home };
}

/** Formular der Karte; die Auswahl geht wie im Spiel als Command an die Domain. */
export function Live(props: {
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
}): ReactElement | null {
  const current = useGameStore((state) => state.game);
  const send = useGameStore((state) => state.send);
  if (current === null) return null;
  return (
    <ChoiceForm
      game={current}
      {...props}
      onSubmit={(choice) =>
        send(
          props.ability === 'primary'
            ? {
                type: 'PerformStrategicAction',
                issuedBy: props.player,
                card: props.card.id,
                choice,
              }
            : { type: 'ResolveSecondary', issuedBy: props.player, choice },
        )
      }
    />
  );
}
