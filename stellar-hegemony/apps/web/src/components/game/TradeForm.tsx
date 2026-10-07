import type { GameState, PlayerId, StrategyCardDefinition, TradeChoice } from '@stellar/domain';
import { type ReactElement, type ReactNode, useState } from 'react';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from './PlayerTag.tsx';

export interface TradeFormProps {
  readonly game: GameState;
  readonly player: PlayerId;
  readonly card: StrategyCardDefinition;
  readonly ability: 'primary' | 'secondary';
  readonly onSubmit: (choice: TradeChoice) => void;
  readonly children?: ReactNode;
}

/** Handel: primär Mitspieler wählen, die die Sekundärfähigkeit ohne Strategiemarker nutzen. */
export function TradeForm(props: TradeFormProps): ReactElement {
  const t = useT();
  const [freeFor, setFreeFor] = useState<readonly PlayerId[]>([]);
  const others = props.game.players.filter((p) => p.id !== props.player).map((p) => p.id);
  const toggle = (id: PlayerId) =>
    setFreeFor((current) =>
      current.includes(id) ? current.filter((other) => other !== id) : [...current, id],
    );
  return (
    <div className="choice-form">
      {props.ability === 'primary' && (
        <fieldset>
          <legend>{t('freeSecondary')}</legend>
          {others.map((id) => (
            <label key={id}>
              <input type="checkbox" checked={freeFor.includes(id)} onChange={() => toggle(id)} />
              <PlayerTag game={props.game} id={id} />
            </label>
          ))}
        </fieldset>
      )}
      <div className="actions">
        <button type="button" onClick={() => props.onSubmit({ mechanic: 'trade', freeFor })}>
          {t('confirm')}
        </button>
        {props.children}
      </div>
    </div>
  );
}
