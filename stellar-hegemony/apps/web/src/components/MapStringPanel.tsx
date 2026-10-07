import { type ReactElement, useEffect, useState } from 'react';
import { isMessageKey, translate } from '../i18n.ts';
import { currentMapString, useGalaxyStore } from '../store.ts';

function ErrorLine({
  prefix,
  text,
}: {
  readonly prefix: string;
  readonly text: string;
}): ReactElement {
  return (
    <p className="error" role="alert">
      {prefix}: {text}
    </p>
  );
}

export function MapStringPanel(): ReactElement {
  const { layout, language, error, importMap } = useGalaxyStore();
  const exported = currentMapString(layout);
  const [draft, setDraft] = useState(exported);
  useEffect(() => setDraft(exported), [exported]);
  const t = (key: Parameters<typeof translate>[1]) => translate(language, key);
  const errorText = error === null ? null : isMessageKey(error.code) ? t(error.code) : error.code;

  return (
    <aside className="map-panel glass">
      <label htmlFor="map-string">{t('mapString')}</label>
      <textarea
        id="map-string"
        value={draft}
        spellCheck={false}
        onChange={(event) => setDraft(event.target.value)}
      />
      <div className="actions">
        <button type="button" onClick={() => importMap(draft)}>
          {t('importMap')}
        </button>
        <button type="button" onClick={() => void navigator.clipboard.writeText(exported)}>
          {t('copyMap')}
        </button>
      </div>
      {errorText !== null && <ErrorLine prefix={t('errorPrefix')} text={errorText} />}
      <p className="hint">{t('shortcuts')}</p>
    </aside>
  );
}
