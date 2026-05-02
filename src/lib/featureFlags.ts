/**
 * Feature Flags — temporary visibility toggles
 *
 * To re-enable a feature, change its value from `false` to `true`.
 */
export const FEATURE_FLAGS = {
  /** Online "Pay Now" payment option (BOG). Set to true to re-enable. */
  ENABLE_PAY_NOW: false,

  /** Facebook login / signup buttons. Set to true to re-enable. */
  ENABLE_FACEBOOK_LOGIN: false,
} as const;
