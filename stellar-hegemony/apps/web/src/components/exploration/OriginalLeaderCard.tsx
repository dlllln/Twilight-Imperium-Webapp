import { FACTION_NAMES, officialLeader, type OfficialLeaderSeed } from '@stellar/content';
import { useLanguage } from '../../use-translation.ts';

function PrintedLeader({ leader }: { readonly leader: OfficialLeaderSeed }) {
  const language = useLanguage();
  const owner = FACTION_NAMES[leader.faction]?.[language] ?? leader.faction;
  return (
    <>
      <p className="original-leader-owner">{owner}</p>
      <a href={`/ti4/${leader.card}`} target="_blank" rel="noreferrer">
        <img src={`/ti4/${leader.card}`} alt={`${leader.name} · ${owner}`} loading="lazy" />
      </a>
      <p lang="en">
        <strong>{leader.window}</strong> {leader.ability}
      </p>
      {leader.kind !== 'agent' && <p lang="en">Unlock: {leader.unlock}</p>}
    </>
  );
}

/** The original card stays readable without presenting its rules as implemented actions. */
export function OriginalLeaderCard({
  id,
  expanded = false,
}: {
  readonly id: string;
  readonly expanded?: boolean;
}) {
  const leader = officialLeader(id);
  const language = useLanguage();
  if (leader === undefined) return null;
  const de = language === 'de';
  return (
    <details className="original-leader-card" open={expanded || undefined}>
      <summary>
        {de ? 'Originalkarte' : 'Original card'}: {leader.name}
      </summary>
      <PrintedLeader leader={leader} />
      <small>
        {de
          ? 'Originalregel auf Englisch. Die Webapp verwendet die separat angezeigte, vereinfachte Wirkung.'
          : 'Original English rule. The web app uses the simplified effect shown separately.'}
      </small>
    </details>
  );
}
