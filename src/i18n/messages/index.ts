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
export const messages: Record<Lang, Record<string, unknown>> = {
  ka: { ...ka, ...contentKa, ...propertyKa, ...accountKa, ...hostKa, ...adminKa, ...corporateKa },
  en: { ...en, ...contentEn, ...propertyEn, ...accountEn, ...hostEn, ...adminEn, ...corporateEn },
  ru: { ...ru, ...contentRu, ...propertyRu, ...accountRu, ...hostRu, ...adminRu, ...corporateRu },
};
