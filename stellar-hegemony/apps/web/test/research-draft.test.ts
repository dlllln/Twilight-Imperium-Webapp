import { planetId, technologyId } from '@stellar/domain';
import { describe, expect, it } from 'vitest';
import { togglePlanet } from '../src/table/payment-draft.ts';
import {
  researchPlan,
  researchRequest,
  toggleSpecialty,
  toggleTechnology,
} from '../src/table/research-draft.ts';

const ALPHA = planetId('alpha');
const BETA = planetId('beta');
const LASER = technologyId('laser');
const DRIVE = technologyId('drive');

describe('Entwurf der Forschungsauslage', () => {
  it('zu Beginn ist nichts gewählt und die Bezahlung in Ressourcen leer', () => {
    expect(researchPlan()).toMatchObject({ kind: 'research', technologies: [], specialties: [] });
    expect(researchRequest(researchPlan())).toEqual({ technologies: [], specialties: [] });
  });

  it('eine wählbare Technologie kommt dazu, eine nicht wählbare nicht', () => {
    const plan = toggleTechnology(researchPlan(), LASER, true);
    expect(plan.technologies).toEqual([LASER]);
    expect(toggleTechnology(plan, DRIVE, false)).toBe(plan);
  });

  it('eine gewählte Technologie lässt sich immer zurücklegen', () => {
    const plan = toggleTechnology(toggleTechnology(researchPlan(), LASER, true), DRIVE, true);
    expect(toggleTechnology(plan, LASER, false).technologies).toEqual([DRIVE]);
  });

  it('eine genutzte Spezialisierung verlässt die Bezahlung', () => {
    const start = researchPlan();
    const paying = { ...start, payment: togglePlanet(start.payment, ALPHA, [ALPHA, BETA]) };
    const plan = toggleSpecialty(paying, ALPHA, [ALPHA]);
    expect(plan.specialties).toEqual([ALPHA]);
    expect(plan.payment.planets).toEqual([]);
    expect(researchRequest(plan)).toEqual({ technologies: [], specialties: [ALPHA] });
  });

  it('nur Planeten mit nutzbarer Spezialisierung, und ein zweites Antippen nimmt sie zurück', () => {
    const plan = researchPlan();
    expect(toggleSpecialty(plan, BETA, [ALPHA])).toBe(plan);
    const used = toggleSpecialty(plan, ALPHA, [ALPHA]);
    expect(toggleSpecialty(used, ALPHA, []).specialties).toEqual([]);
  });
});
