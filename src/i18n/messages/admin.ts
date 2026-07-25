// i18n namespace: admin dashboard (admin/page + all admin panels).
// English is the source of truth; ka/ru must match its shape (enforced by AdminNs).
import type { Widen } from './_widen';

export const adminEn = {} as const;

export type AdminNs = Widen<typeof adminEn>;

export const adminKa: AdminNs = {};
export const adminRu: AdminNs = {};
