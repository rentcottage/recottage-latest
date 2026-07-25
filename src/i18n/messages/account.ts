// i18n namespace: guest account + shared modals + auth sub-flows
// (profile page + BookingCard/ChangeDatesModal/WriteReviewModal, AuthModals,
// ContactModal, CancellationModal, PhoneVerifyModal, ProfileCompletionGate,
// auth-callback, auth-reset-password, become-host form body).
// English is the source of truth; ka/ru must match its shape (enforced by AccountNs).
import type { Widen } from './_widen';

export const accountEn = {} as const;

export type AccountNs = Widen<typeof accountEn>;

export const accountKa: AccountNs = {};
export const accountRu: AccountNs = {};
