import type { PlanetId, ResearchRequest, TechnologyId } from '@stellar/domain';
import { paymentPlan } from './payment-draft.ts';
import type { ResearchPlan } from './spec-types.ts';

/*
 * Entwurf der Forschungsauslage (reine Funktionen): gewählte Technologien, genutzte
 * Spezialisierungen und die Bezahlung. Was wählbar ist, entscheidet die Entscheidung mit der
 * Domain; hier wird nur gelegt und zurückgenommen.
 */

export const researchPlan = (): ResearchPlan => ({
  kind: 'research',
  technologies: [],
  specialties: [],
  payment: paymentPlan('resources'),
});

const without = <T>(list: readonly T[], item: T): readonly T[] =>
  list.filter((entry) => entry !== item);

/** Gewählte Technologien legt man immer zurück; neue nur, wenn sie wählbar sind. */
export function toggleTechnology(
  plan: ResearchPlan,
  technology: TechnologyId,
  selectable: boolean,
): ResearchPlan {
  if (plan.technologies.includes(technology))
    return { ...plan, technologies: without(plan.technologies, technology) };
  return selectable ? { ...plan, technologies: [...plan.technologies, technology] } : plan;
}

/**
 * Eine Spezialisierung nutzen oder zurücknehmen. Ein genutzter Planet wird beim Erforschen
 * erschöpft und kann nicht zugleich bezahlen; er verlässt die Bezahlung.
 */
export function toggleSpecialty(
  plan: ResearchPlan,
  planet: PlanetId,
  usable: readonly PlanetId[],
): ResearchPlan {
  if (plan.specialties.includes(planet))
    return { ...plan, specialties: without(plan.specialties, planet) };
  if (!usable.includes(planet)) return plan;
  const payment = { ...plan.payment, planets: without(plan.payment.planets, planet) };
  return { ...plan, specialties: [...plan.specialties, planet], payment };
}

/** Was erforscht wird, wie `researchEvents` es prüft. */
export const researchRequest = (plan: ResearchPlan): ResearchRequest => ({
  technologies: plan.technologies,
  specialties: plan.specialties,
});
