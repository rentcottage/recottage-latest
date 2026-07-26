import en, { type Messages } from './en';
import ka from './ka';
import ru from './ru';
import type { Lang } from '../config';
import { contentEn, contentKa, contentRu } from './content';
import { propertyEn, propertyKa, propertyRu } from './property';
import { accountEn, accountKa, accountRu } from './account';
import { hostEn, hostKa, hostRu } from './host';
import { adminEn, adminKa, adminRu } from './admin';
import { corporateEn, corporateKa, corporateRu } from './corporate';

// `Messages` = the core English shape (common/nav/footer/hero/searchBar/home/
// auth/notFound/errors). Modular namespaces below extend the runtime catalog;
// `t()` resolves dotted keys dynamically, so the composite is typed loosely.
export type { Messages };

// Each language merges the core catalog with every namespace slice. Namespace
// files own their own ka/ru↔en completeness (per-namespace typing), so this
// composite is intentionally a loose record for dynamic dotted-key lookups.
//
// IMPORTANT: `content` is spread flat (its own pages call bare keys like
// `t('siteMap.x')`, `t('search.x')` — no `content.` prefix). Every other
// namespace's wired pages call `t()` WITH their namespace prefix
// (`t('property.detail.x')`, `t('account.profile.x')`, `t('host.dashboard.x')`,
// `t('admin.gate.x')`, `t('corporate.landing.x')`), so those five must be
// nested under their namespace key rather than spread — spreading them flat
// (as before) left every `t('<namespace>.…')` call unresolvable at runtime,
// silently rendering the raw key string instead of translated text.
export const messages: Record<Lang, Record<string, unknown>> = {
  ka: { ...ka, ...contentKa, property: propertyKa, account: accountKa, host: hostKa, admin: adminKa, corporate: corporateKa },
  en: { ...en, ...contentEn, property: propertyEn, account: accountEn, host: hostEn, admin: adminEn, corporate: corporateEn },
  ru: { ...ru, ...contentRu, property: propertyRu, account: accountRu, host: hostRu, admin: adminRu, corporate: corporateRu },
};
