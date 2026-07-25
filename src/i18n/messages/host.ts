// i18n namespace: host dashboard (host-dashboard/page + all Host* sections).
// English is the source of truth; ka/ru must match its shape (enforced by HostNs).
import type { Widen } from './_widen';

export const hostEn = {} as const;

export type HostNs = Widen<typeof hostEn>;

export const hostKa: HostNs = {};
export const hostRu: HostNs = {};
