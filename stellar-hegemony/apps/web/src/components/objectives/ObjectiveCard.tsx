import type { GameState, ObjectiveDefinition, PlayerId } from '@stellar/domain';
import { scoredBy } from '@stellar/domain';
import type { ReactElement, ReactNode } from 'react';
import { objectiveLabel, objectiveRequirement } from '../../labels.ts';
import { useLanguage } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';

/** Ein Auftrag mit Name, Anforderung, Punkten und den Spielern, die ihn gewertet haben. */
export function ObjectiveCard({
  game,
  definition,
  children,
}: {
  readonly game: GameState;
  readonly definition: ObjectiveDefinition;
  readonly children?: ReactNode;
}): ReactElement {
  const language = useLanguage();
  const scorers: readonly PlayerId[] = scoredBy(game, definition.id);
  return (
    <li className={`objective-card ${definition.category} stage-${String(definition.stage ?? 0)}`}>
      <span className="points">{definition.points}</span>
      <strong>{objectiveLabel(definition.id, language)}</strong>
      <span className="requirement">{objectiveRequirement(definition.id, language)}</span>
      {scorers.length > 0 && (
        <span className="scorers">
          {scorers.map((id) => (
            <PlayerTag key={id} game={game} id={id} />
          ))}
        </span>
      )}
      {children}
    </li>
  );
}
