import { es, enUS, gl, zhCN, hi, fr, arSA, pt, de, ru, it } from 'date-fns/locale';

const LOCALE_MAP: Record<string, any> = {
  es,
  en: enUS,
  gl,
  zh: zhCN,
  hi,
  fr,
  ar: arSA,
  pt,
  de,
  ru,
  it,
};

export function getDateLocale(code: string) {
  return LOCALE_MAP[code] || es;
}