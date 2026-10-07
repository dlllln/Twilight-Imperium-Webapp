import { findPlayer, type GameState, type PlayerId, scoringOptions } from '@stellar/domain';
import type { ReactElement } from 'react';
import { useViewer } from '../../game-store.ts';
import { content } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { PlayerTag } from '../game/PlayerTag.tsx';
import { ObjectiveCard } from './ObjectiveCard.tsx';
import { ScoreAction } from './ScoreAction.tsx';

const definitionOf = (id: string) => content.objectives.find((objective) => objective.id === id);

/** RR 68: Siegpunkte aller Spieler im Verhältnis zum Ziel. */
function VictoryTrack({ game }: { readonly game: GameState }): ReactElement {
  const target = game.config.victoryPointsToWin;
  return (
    <ul className="victory-track">
      {game.players.map((player) => (
        <li key={player.id}>
          <PlayerTag game={game} id={player.id} />
          <span className="vp-bar">
            <span style={{ width: `${String((player.victoryPoints / target) * 100)}%` }} />
          </span>
          <strong data-testid={`vp-${player.id}`}>
            {player.victoryPoints}/{target}
          </strong>
        </li>
      ))}
    </ul>
  );
}

function PublicRow({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  return (
    <ol className="objective-row">
      {game.objectives.public.map((slot, index) => {
        const definition = definitionOf(slot.id);
        if (!slot.revealed || definition === undefined)
          return (
            <li
              key={`${slot.id}-${String(index)}`}
              className={`objective-card hidden stage-${String(slot.stage)}`}
            >
              {slot.stage === 1 ? t('stageOne') : t('stageTwo')}
            </li>
          );
        return <ObjectiveCard key={slot.id} game={game} definition={definition} />;
      })}
    </ol>
  );
}

/** Die geheimen Aufträge des Spielers am Bildschirm; Aktionsphase-Aufträge lassen sich hier werten. */
function SecretList({ game, player }: { readonly game: GameState; readonly player: PlayerId }) {
  const t = useT();
  const secrets = findPlayer(game, player)?.secretObjectives ?? [];
  const actionOptions = game.phase === 'action' ? scoringOptions(game, player, content) : [];
  if (secrets.length === 0) return null;
  return (
    <>
      <h3>
        {t('secretObjectives')} <PlayerTag game={game} id={player} />
      </h3>
      <ul className="objective-row">
        {secrets.flatMap((id) => {
          const definition = definitionOf(id);
          const option = actionOptions.find((candidate) => candidate.definition.id === id);
          return definition === undefined
            ? []
            : [
                <ObjectiveCard key={id} game={game} definition={definition}>
                  {option !== undefined && (
                    <ScoreAction game={game} player={player} option={option} />
                  )}
                </ObjectiveCard>,
              ];
        })}
      </ul>
    </>
  );
}

/** Seitenleiste: Siegpunkte, öffentliche Aufträge und die eigenen geheimen. */
export function ObjectivesPanel({ game }: { readonly game: GameState }): ReactElement {
  const t = useT();
  const actor = useViewer(game);
  return (
    <section className="game-section objectives-panel">
      <h2>{t('objectives')}</h2>
      <VictoryTrack game={game} />
      <PublicRow game={game} />
      {actor !== null && <SecretList game={game} player={actor} />}
    </section>
  );
}
