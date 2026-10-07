import type { GameState, PlayerId, StrategyCardDefinition, StrategyChoice } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import { DiplomacyForm } from './DiplomacyForm.tsx';
import { TokenForm } from './TokenForm.tsx';

export interface ChoiceFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: StrategyChoice) => void;
  readonly children?: ReactNode;
}

/** Wählt das passende Formular zur Mechanik der Strategiekarte (Polymorphie statt if-Ketten im Panel). */
export function ChoiceForm(props: ChoiceFormProps): ReactElement {
  return props.card.mechanic === 'diplomacy' ? (
    <DiplomacyForm {...props} />
  ) : (
    <TokenForm {...props} />
  );
}
