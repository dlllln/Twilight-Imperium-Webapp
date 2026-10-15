import type { TechnologyColor } from '@stellar/domain';
import { Cpu, Dna, Gauge, type LucideIcon, Swords } from 'lucide-react';

/** Symbol je Technologiefarbe; Vorratsleiste und Kommandopult zeigen dieselben. */
export const TECH_ICONS: Readonly<Record<TechnologyColor, LucideIcon>> = {
  propulsion: Gauge,
  biotic: Dna,
  cybernetic: Cpu,
  warfare: Swords,
};
