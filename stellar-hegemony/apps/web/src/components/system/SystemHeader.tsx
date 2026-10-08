import { ArrowLeft, Crosshair, Hexagon, Orbit } from 'lucide-react';
import type { ReactElement } from 'react';
import { useGameStore } from '../../game-store.ts';
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

/** Kopfzeile der Systemansicht: zurück zur Karte, Name, Kennzeichen, im Spiel „System wählen“. */
export function SystemHeader({ hex }: { readonly hex: SceneHex }): ReactElement {
  const t = useT();
  const close = useSystemViewStore((state) => state.close);
  const playing = useGameStore((state) => state.game !== null);
  const choose = () => {
    useGameStore.getState().select(hex.systemId);
    close();
  };
  const names = hex.planets.map((planet) => planet.name).join(' · ');
  return (
    <header className="system-header glass">
      <button type="button" className="icon-button" onClick={close}>
        <ArrowLeft size={18} aria-hidden="true" /> {t('closeSystem')}
      </button>
      <div className="system-title">
        <h2>{hex.systemId?.toUpperCase() ?? ''}</h2>
        <span>{names === '' ? t(hex.anomaly ?? 'emptySpace') : names}</span>
      </div>
      <Badges hex={hex} />
      {playing && hex.systemId !== null && (
        <button type="button" className="primary icon-button" onClick={choose}>
          <Crosshair size={18} aria-hidden="true" /> {t('selectThisSystem')}
        </button>
      )}
    </header>
  );
}
