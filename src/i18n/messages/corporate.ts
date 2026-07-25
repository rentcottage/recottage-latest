// i18n namespace: corporate pages + legal pages
// (corporate landing, corporate/dashboard, terms, privacy).
// English is the source of truth; ka/ru must match its shape (enforced by CorporateNs).
import type { Widen } from './_widen';

export const corporateEn = {} as const;

export type CorporateNs = Widen<typeof corporateEn>;

export const corporateKa: CorporateNs = {};
export const corporateRu: CorporateNs = {};
