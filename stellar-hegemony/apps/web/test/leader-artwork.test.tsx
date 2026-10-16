// @vitest-environment jsdom
import { LEADERS, TI4_FACTION_METADATA, officialLeader, leaderIsReference } from '@stellar/content';
import { leaderId, playerId } from '@stellar/domain';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { leaderArtwork, leaderFrame } from '../src/artwork/leaders.ts';
import { HandFace } from '../src/components/hand/HandFaces.tsx';
import { FactionLeaders } from '../src/components/faction/FactionLeaders.tsx';
import { started } from './game-helpers.ts';
import { useGalaxyStore } from '../src/store.ts';

afterEach(cleanup);

describe('Faction-specific leader cards', () => {
  it('keeps every original leader, portrait and printed rule attached to its own faction', () => {
    const references = Object.values(TI4_FACTION_METADATA).flatMap((faction) => faction.leaders);
    expect(references).toHaveLength(92);
    expect(new Set(references.map((leader) => leader.sourceId)).size).toBe(92);
    for (const faction of Object.values(TI4_FACTION_METADATA))
      for (const leader of faction.leaders) {
        expect(leader.faction).toBe(faction.id);
        expect(LEADERS.find((definition) => definition.id === leader.id)?.faction).toBe(faction.id);
        expect(leader.ability.length).toBeGreaterThan(0);
        expect(leaderFrame(leader.id)?.path).toBe(`/ti4/cards/leaders/${leader.sourceId}.png`);
        expect(leaderArtwork(leader.id)?.path).toBe(leaderFrame(leader.id)?.path);
      }
  });

  it('shows Evelyn DeLouis and her ground combat ability instead of a relic or an unrelated action', () => {
    useGalaxyStore.setState({ language: 'de' });
    const { container } = render(
      <HandFace
        game={started()}
        entry={{
          kind: 'leader',
          leader: { id: leaderId('ti4-sol-agent'), kind: 'agent', status: 'ready' },
          player: playerId('p1'),
          playable: true,
        }}
      />,
    );
    expect(screen.getByText('Evelyn DeLouis')).toBeTruthy();
    expect(container.querySelector('.hand-text')?.textContent).toContain(
      'ground force rolls 1 additional die',
    );
    expect(
      Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src')),
    ).toEqual(['/ti4/cards/leaders/solagent.png', '/ti4/cards/leaders/solagent.png']);
  });

  it('retains all three Nomad agents without duplicating the inherited web app action', () => {
    const nomad = TI4_FACTION_METADATA['nomad'];
    const agents = nomad?.leaders.filter((leader) => leader.kind === 'agent') ?? [];
    expect(agents.map((leader) => leader.name)).toEqual([
      'Field Marshal Mercer',
      'The Thundarian',
      'Artuno the Betrayer',
    ]);
    expect(agents.filter((leader) => leaderIsReference(leader.id))).toHaveLength(2);
    for (const agent of agents.filter((leader) => leaderIsReference(leader.id))) {
      const definition = LEADERS.find((leader) => leader.id === agent.id);
      expect(definition?.kind === 'agent' && definition.action).toEqual([]);
    }
  });

  it('shows only the selected faction’s original cards and never substitutes a relic for an unknown leader', () => {
    useGalaxyStore.setState({ language: 'de' });
    render(<FactionLeaders id="sol" />);
    expect(screen.getByText('Originalkarte: Evelyn DeLouis')).toBeTruthy();
    expect(screen.getByText('Originalkarte: Claire Gibson')).toBeTruthy();
    expect(screen.getByText('Originalkarte: Jace X, 4th Air Legion')).toBeTruthy();
    expect(screen.queryByText(/Carth of Golden Sands/)).toBeNull();
    expect(leaderFrame('ilka-brenn')).toBeUndefined();
    expect(leaderArtwork('unknown')).toBeUndefined();
    expect(officialLeader('unknown')).toBeUndefined();
  });
});
