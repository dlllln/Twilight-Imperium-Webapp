import { TI4_FACTION_METADATA } from '@stellar/content';
import { useLanguage } from '../../use-translation.ts';
import { OriginalLeaderCard } from '../exploration/OriginalLeaderCard.tsx';

export function FactionLeaders({ id }: { readonly id: string }) {
  const language = useLanguage();
  return (
    <section
      className="faction-leader-cards"
      aria-label={language === 'de' ? 'Originale Anführerkarten' : 'Original leader cards'}
    >
      {TI4_FACTION_METADATA[id]?.leaders.map((leader) => (
        <OriginalLeaderCard key={leader.id} id={leader.id} />
      ))}
    </section>
  );
}
