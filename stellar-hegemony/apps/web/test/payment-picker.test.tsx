// @vitest-environment jsdom
import { type GameState, type PlayerId, spendablePlanets } from '@stellar/domain';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PaymentPicker, usePayment } from '../src/components/game/PaymentPicker.tsx';
import { useGameStore } from '../src/game-store.ts';
import { content, useGalaxyStore } from '../src/store.ts';
import {
  usePaymentStore,
  useRegisterPlanetRow,
  NO_PAYMENTS,
  openOf,
} from '../src/table/payment-store.ts';
import { pickAll, started } from './game-helpers.ts';
import { leaveTable } from './local-table.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
  usePaymentStore.setState(NO_PAYMENTS);
});

afterEach(() => {
  cleanup();
  leaveTable();
});

/** Aktionsphase; der Aktive sitzt am Bildschirm. */
function seated(): PlayerId {
  const game = pickAll(started());
  const me = game.actionPhase?.active as PlayerId;
  useGameStore.setState({ game, me });
  return me;
}

/** Steht wie am Pult eine Planetenreihe, meldet sie sich an. */
function PlanetRowStandIn(): null {
  useRegisterPlanetRow();
  return null;
}

function Picker({ me, row }: { readonly me: PlayerId; readonly row: boolean }): ReactElement {
  const game = useGameStore((state) => state.game) as GameState;
  const state = usePayment(game, me, 'resources');
  return (
    <>
      {row && <PlanetRowStandIn />}
      <PaymentPicker game={game} player={me} currency="resources" required={3} state={state} />
    </>
  );
}

describe('Bezahlung im Formular und am Tisch', () => {
  it('mit Planetenreihe zeigt die Bezahlung nur die Messleiste, kein Formular', () => {
    const me = seated();
    render(<Picker me={me} row />);
    expect(document.querySelector('fieldset.payment')).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(screen.queryByRole('spinbutton')).toBeNull();
    const meter = document.querySelector('.payment-meter');
    expect(meter?.getAttribute('aria-live')).toBe('polite');
    expect(meter?.textContent).toBe('Ressourcen: 0 / 3');
    expect(screen.getByText(/Tippe Planetenkarten oder Planeten auf der Karte an/)).toBeTruthy();
    expect(openOf(usePaymentStore.getState())).toMatchObject({ player: me, required: 3 });
  });

  it('ohne Planetenreihe bleibt das Formular mit Kontrollkästchen', () => {
    const me = seated();
    const game = useGameStore.getState().game as GameState;
    const [first] = spendablePlanets(game, content.tiles, me, 'resources');
    render(<Picker me={me} row={false} />);
    expect(document.querySelector('.payment-meter')).toBeNull();
    const boxes = screen.getAllByRole<HTMLInputElement>('checkbox');
    expect(boxes.length).toBeGreaterThan(0);
    fireEvent.click(boxes[0] as HTMLInputElement);
    expect(boxes[0]?.checked).toBe(true);
    expect(screen.getByTestId('paid').textContent).toBe(String(first?.value));
    expect(screen.getByRole('spinbutton')).toBeTruthy();
  });
});
