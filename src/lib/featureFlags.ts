/**
 * Feature Flags — temporary visibility toggles
 *
 * To re-enable a feature, change its value from `false` to `true`.
 */
export const FEATURE_FLAGS = {
  /** Online "Pay Now" payment option (BOG). Set to true to re-enable. */
  ENABLE_PAY_NOW: true,

  /** Facebook login / signup buttons. Set to true to re-enable. */
  ENABLE_FACEBOOK_LOGIN: false,

  /**
   * Offers & Promos public surfaces (home section, search banner, property
   * discount). Built but dormant — flip to true when the first offers land.
   * Admin panel promo management works regardless of this flag.
   */
  ENABLE_PROMOS: false,
} as const;
