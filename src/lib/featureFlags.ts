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
   * discount). Live: an offer created and activated in the admin panel shows
   * up on the site by itself — nothing appears while no promo is active.
   */
  ENABLE_PROMOS: true,
} as const;
