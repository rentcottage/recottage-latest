// i18n namespace: static content + search pages
// (how-it-works, about-georgia, host-resources, sitemap, search).
// English is the source of truth; ka/ru must match its shape (enforced by ContentNs).
import type { Widen } from './_widen';

export const contentEn = {} as const;

export type ContentNs = Widen<typeof contentEn>;

export const contentKa: ContentNs = {};
export const contentRu: ContentNs = {};
