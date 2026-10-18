import { memo } from 'react';
import { Compass } from 'lucide-react';
import { useGameStore } from '../game-store.ts';
import { useT } from '../use-translation.ts';

function SpaceLayers() {
  return (
    <div className="galaxy-ambience" aria-hidden="true">
      <div className="astral-haze" />
      <div className="astral-orbit" />
      <div className="astral-meteor" />
      <i className="astral-star" />
      <i className="astral-star" />
      <i className="astral-star" />
    </div>
  );
}

/** Decorative CSS layers never restart the WebGL renderer or consume pointer events. */
export const GalaxyAmbience = memo(function GalaxyAmbience({
  sectors,
}: {
  readonly sectors: number;
}) {
  const playing = useGameStore((state) => state.game !== null);
  const t = useT();
  return (
    <>
      <SpaceLayers />
      {!playing && (
        <div className="atlas-caption">
          <span className="eyebrow">
            <Compass size={12} aria-hidden="true" /> {t('atlasNavigation')}
          </span>
          <strong>{t('atlasTitle')}</strong>
          <span className="atlas-sectors">
            <i aria-hidden="true" /> {sectors} {t('atlasSectors')}
          </span>
        </div>
      )}
    </>
  );
});
