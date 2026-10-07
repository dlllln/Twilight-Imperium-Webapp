import type { ReactElement } from 'react';
import { errorText } from '../../i18n.ts';
import { useOnlineStore } from '../../online/online-store.ts';
import { useLanguage } from '../../use-translation.ts';

export function OnlineError(): ReactElement | null {
  const language = useLanguage();
  const error = useOnlineStore((state) => state.error);
  if (error === null) return null;
  return (
    <p className="error" role="alert">
      {errorText(language, error.code)}
    </p>
  );
}
