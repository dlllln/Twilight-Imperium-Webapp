import { Orbit } from 'lucide-react';
import { useT } from '../../use-translation.ts';

export function MissionBriefing() {
  const t = useT();
  return (
    <div className="mission-briefing">
      <div className="mission-orbit" aria-hidden="true">
        <Orbit size={58} strokeWidth={0.8} />
      </div>
      <p className="eyebrow">Twilight Imperium</p>
      <h3>{t('missionTitle')}</h3>
      <p className="mission-copy">{t('missionCopy')}</p>
      <div className="mission-divider" aria-hidden="true">
        <span />
        <i />
        <span />
      </div>
    </div>
  );
}
