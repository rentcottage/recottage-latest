// Layout maths for the phone hero (vertical 9:16 clip). Kept free of React so
// it can be unit-tested.

/**
 * Phone offer banner, overlaid on the snow below the cottage's porch.
 * In the vertical clip the porch (deck + stone wall) ends at ~82% of the
 * frame height; below that there is only snow. The banner is anchored this
 * far above the hero's bottom edge, and is only shown in the hero when it
 * clears the porch by at least OFFER_MIN_CLEARANCE on the current screen.
 */
export const PORCH_BOTTOM = 0.82;
export const OFFER_BOTTOM_GAP = 28;
export const OFFER_HEIGHT = 40; // the pill is 34px; a little headroom for safety
export const OFFER_MIN_CLEARANCE = 12;

/** Does the banner fit between the porch and the hero's bottom edge? */
export function offerFitsBelowPorch(heroWidth: number, heroHeight: number): boolean {
  // The 9:16 clip covers the hero (object-cover, centred).
  const coverH = Math.max(heroHeight, heroWidth * 16 / 9);
  const porchBottom = (heroHeight - coverH) / 2 + PORCH_BOTTOM * coverH;
  const offerTop = heroHeight - OFFER_BOTTOM_GAP - OFFER_HEIGHT;
  return offerTop - porchBottom >= OFFER_MIN_CLEARANCE;
}
