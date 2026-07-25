// i18n namespace: property detail + booking-flow pages
// (property page, PropertyReviews, PropertyGallery, book-experience,
// payment-success, payment-failed).
// English is the source of truth; ka/ru must match its shape (enforced by PropertyNs).
import type { Widen } from './_widen';

export const propertyEn = {} as const;

export type PropertyNs = Widen<typeof propertyEn>;

export const propertyKa: PropertyNs = {};
export const propertyRu: PropertyNs = {};
