// @vitest-environment jsdom
import {
  type ProductionChoice,
  systemId,
  type TechnologyDefinition,
  unitTypeId,
} from '@stellar/domain';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProductionMeter, ResearchMeter } from '../src/components/table/PromptMeters.tsx';
import { content, useGalaxyStore } from '../src/store.ts';
import type { Shipyard } from '../src/table/shipyard.ts';
import type { ResearchSpread } from '../src/table/spec-research.ts';

beforeEach(() => {
  useGalaxyStore.setState({ language: 'de' });
});

afterEach(cleanup);

const infantry = content.units.find(unitTypeId('infantry'));

const choice: ProductionChoice = {
  unit: infantry as NonNullable<typeof infantry>,
  ordered: 2,
  canAdd: true,
  supply: null,
};

function yard(cost: number, blockaded = false): Shipyard {
  return {
    system: systemId('home'),
    choices: [choice],
    quote: { limit: 5, count: 2, cost, blockaded: false, groundPlanets: [] },
    groundPlanet: null,
    needsGround: true,
    blockaded,
  };
}

const technology = content.technologies[0] as TechnologyDefinition;

function spread(required: number, unusedSpecialty = false): ResearchSpread {
  const cards = [{ technology, missing: [], state: 'chosen' as const }];
  return {
    columns: [{ color: technology.color, cards }],
    specialties: [],
    count: 1,
    max: 2,
    required,
    unusedSpecialty,
    unmet: [],
  };
}

const meterText = () => document.querySelector('.table-prompt-meter')?.textContent ?? '';

describe('Messleisten der Werft und der Forschungsauslage', () => {
  it('Werft: Einheiten im Dock, Kosten und bezahlt / benötigt', () => {
    render(<ProductionMeter yard={yard(1)} paid={0} />);
    expect(meterText()).toContain('Im Dock: 2 / 5');
    expect(screen.getByTestId('production-cost').textContent).toBe('1');
    expect(screen.getByTestId('paid').textContent).toBe('0');
    expect(meterText()).toContain('Ressourcen: 0 / 1');
    expect(screen.queryByText(/Blockade|blockiert/i)).toBeNull();
  });

  it('Werft: ohne Kosten keine Bezahlung, eine Blockade wird genannt', () => {
    const { container } = render(<ProductionMeter yard={yard(0, true)} paid={null} />);
    expect(screen.queryByTestId('paid')).toBeNull();
    expect(screen.getByTestId('production-cost').textContent).toBe('0');
    expect(container.querySelector('.warning')).not.toBeNull();
  });

  it('Forschung: gewählt / erlaubt, bezahlt nur, solange sie etwas kostet', () => {
    render(<ResearchMeter spread={spread(0)} paid={null} />);
    expect(meterText()).toContain('Gewählt: 1 / 2');
    expect(screen.queryByTestId('paid')).toBeNull();
    cleanup();
    render(<ResearchMeter spread={spread(6)} paid={4} />);
    expect(screen.getByTestId('paid').textContent).toBe('4');
    expect(meterText()).toContain('Ressourcen: 4 / 6');
  });

  it('Forschung: einer gewählten Karte fehlt eine Voraussetzung; die Messleiste nennt sie', () => {
    const unmet = { technology, missing: ['biotic' as const], state: 'chosen' as const };
    render(<ResearchMeter spread={{ ...spread(0), unmet: [unmet] }} paid={null} />);
    const text = screen.getByTestId('research-unmet').textContent;
    expect(text).toMatch(/^Voraussetzungen fehlen für .+: Biotik$/);
    expect(meterText()).toContain(text);
  });

  it('Forschung: eine nicht gebrauchte Spezialisierung wird gemeldet', () => {
    render(<ResearchMeter spread={spread(0, true)} paid={null} />);
    expect(screen.getByText('Eine gewählte Spezialisierung wird nicht gebraucht.')).toBeTruthy();
  });
});
