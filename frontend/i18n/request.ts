import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const LOCALES = ['tr', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'tr';

export default getRequestConfig(async () => {
  const store = await cookies();
  const raw = store.get('od_locale')?.value;
  const locale: Locale = LOCALES.includes(raw as Locale) ? (raw as Locale) : DEFAULT_LOCALE;
  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
