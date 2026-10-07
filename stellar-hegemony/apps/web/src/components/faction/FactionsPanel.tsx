import type { GameState, PlayerState } from '@stellar/domain';
import type { ReactElement } from 'react';
import { factionAbilityEffect, factionAbilityLabel, factionLabel } from '../../labels.ts';
import { content } from '../../store.ts';
import { useLanguage, useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';

function FactionEntry({
  game,
  player,
}: {
  readonly game: GameState;
  readonly player: PlayerState;
}): ReactElement {
  const language = useLanguage();
  const faction = content.factions.find((candidate) => candidate.id === player.faction);
  return (
    <li data-testid={`faction-${player.id}`}>
      <div className="faction-head">
        <PlayerTag game={game} id={player.id} />
        <strong>{factionLabel(player.faction, language)}</strong>
      </div>
      <ul className="faction-abilities">
        {(faction?.abilities ?? []).map((ability) => (
          <li key={ability.id}>
            <strong>{factionAbilityLabel(ability.id, language)}</strong>
            <span>{factionAbilityEffect(ability.id, language)}</span>
          </li>
        ))}
      </ul>
    </li>
  );
}

/** RR 27.21: Fraktion jedes Spielers mit ihren Fähigkeiten (eigene Entwürfe). */
export function FactionsPanel({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  return (
    <details className="game-section factions-panel">
      <summary>
        <h2>{t('factions')}</h2>
      </summary>
      <ul>
        {game.players.map((player) => (
          <FactionEntry key={player.id} game={game} player={player} />
        ))}
      </ul>
    </details>
  );
}
