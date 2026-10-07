import type { GameState, PlayerId, StrategyCardDefinition, StrategyChoice } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import { ImperialForm } from '../objectives/ImperialForm.tsx';
import { TechnologyForm } from '../technology/TechnologyForm.tsx';
import { ConstructionForm } from './ConstructionForm.tsx';
import { DiplomacyForm } from './DiplomacyForm.tsx';
import { PoliticsForm } from './PoliticsForm.tsx';
import { TokenForm } from './TokenForm.tsx';
import { TradeForm } from './TradeForm.tsx';
import { WarfareForm } from './WarfareForm.tsx';

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
  switch (props.card.mechanic) {
    case 'diplomacy':
      return <DiplomacyForm {...props} />;
    case 'construction':
      return <ConstructionForm {...props} />;
    case 'trade':
      return <TradeForm {...props} />;
    case 'warfare':
      return <WarfareForm {...props} />;
    case 'technology':
      return <TechnologyForm {...props} />;
    case 'imperial':
      return <ImperialForm {...props} />;
    case 'politics':
      return <PoliticsForm {...props} />;
    default:
      return <TokenForm {...props} />;
  }
}
