import { type Language, type MessageKey, translate } from './i18n.ts';
import { useGalaxyStore } from './store.ts';

export const useLanguage = (): Language => useGalaxyStore((state) => state.language);

/** Übersetzungsfunktion für die aktuell gewählte Sprache. */
export function useT(): (key: MessageKey) => string {
  const language = useLanguage();
  return (key) => translate(language, key);
}
