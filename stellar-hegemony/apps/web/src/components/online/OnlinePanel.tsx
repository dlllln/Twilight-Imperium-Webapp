import { Globe } from 'lucide-react';
import { type FormEvent, type ReactElement, useState } from 'react';
import { useOnlineStore } from '../../online/online-store.ts';
import { currentMapString, useGalaxyStore } from '../../store.ts';
import { useT } from '../../use-translation.ts';
import { OnlineError } from './OnlineError.tsx';
import { MissionBriefing } from './MissionBriefing.tsx';

function JoinForm(): ReactElement {
  const t = useT();
  const join = useOnlineStore((state) => state.join);
  const [code, setCode] = useState('');
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void join(code);
  };
  return (
    <form className="join-form" onSubmit={submit}>
      <input
        aria-label={t('lobbyCode')}
        placeholder={t('lobbyCode')}
        value={code}
        maxLength={6}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
      />
      <button type="submit" disabled={code.trim().length === 0}>
        {t('joinGame')}
      </button>
    </form>
  );
}

/** Vor der Partie: eine Online-Lobby eröffnen oder mit einem Code beitreten. */
export function OnlinePanel(): ReactElement {
  const t = useT();
  const { name, setName, host, status } = useOnlineStore();
  const { layout, playerCount } = useGalaxyStore();
  const busy = status === 'connecting';
  return (
    <section className="online-panel glass" aria-label={t('online')} data-tutorial="online">
      <MissionBriefing />
      <h2 className="setup-title">
        <Globe size={16} aria-hidden="true" /> {t('online')}
      </h2>
      <label>
        {t('yourName')}
        <input value={name} maxLength={24} onChange={(event) => setName(event.target.value)} />
      </label>
      <button
        type="button"
        className="primary"
        disabled={busy}
        onClick={() => void host(playerCount, currentMapString(layout))}
      >
        {t('hostOnline')}
      </button>
      <p className="hint">{t('hostHint')}</p>
      <JoinForm />
      <OnlineError />
    </section>
  );
}
