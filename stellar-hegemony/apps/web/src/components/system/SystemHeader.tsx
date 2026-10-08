import { ArrowLeft, Hexagon, Orbit } from 'lucide-react';
import type { ReactElement } from 'react';
import type { SceneHex } from '../../render/scene-model.ts';
import { seatColor } from '../../seat-colors.ts';
import { useSystemViewStore } from '../../system/system-view-store.ts';
import { useT } from '../../use-translation.ts';

function Badges({ hex }: { readonly hex: SceneHex }): ReactElement {
  const t = useT();
  return (
    <div className="system-badges">
      {hex.seat !== null && (
        <span className="tag">
          {t('homeSystem')} · {t('seat')} {hex.seat}
        </span>
      )}
      {hex.anomaly !== undefined && <span className="tag anomaly">{t(hex.anomaly)}</span>}
      {hex.wormholes.map((kind) => (
        <span key={kind} className="tag">
          <Orbit size={14} aria-hidden="true" /> {t('wormhole')} {kind === 'alpha' ? 'α' : 'β'}
        </span>
      ))}
      {hex.tokens.length > 0 && (
        <span className="tag" title={t('commandTokens')}>
          <Hexagon size={14} aria-hidden="true" />
          {hex.tokens.map((seat) => (
            <span key={seat} className="swatch" style={{ background: seatColor(seat) }} />
          ))}
        </span>
      )}
    </div>
  );
}

/** Schwebender Titel der Systemansicht: zurück zur Karte, Name und Kennzeichen, ohne Rahmen. */
export function SystemHeader({ hex }: { readonly hex: SceneHex }): ReactElement {
  const t = useT();
  const close = useSystemViewStore((state) => state.close);
  const names = hex.planets.map((planet) => planet.name).join(' · ');
  return (
    <header className="system-header">
      <button type="button" className="round-button" aria-label={t('closeSystem')} onClick={close}>
        <ArrowLeft size={18} aria-hidden="true" />
      </button>
      <div className="system-title">
        <h2>{hex.systemId?.toUpperCase() ?? ''}</h2>
        <span>{names === '' ? t(hex.anomaly ?? 'emptySpace') : names}</span>
      </div>
      <Badges hex={hex} />
    </header>
  );
}
