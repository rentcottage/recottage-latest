/**
 * Google Translate ⇄ React DOM crash guard.
 *
 * This site localizes to Georgian ENTIRELY via Google Translate (index.html sets
 * `googtrans=/en/ka` for first-time visitors and injects the GT widget). While GT
 * is active it swaps text nodes for `<font>` wrappers. When React later mounts or
 * removes a conditional subtree (e.g. the booking price breakdown appearing once
 * both dates are picked) it calls removeChild / insertBefore on a node GT has
 * moved — the browser throws NotFoundError mid-render and, with no error boundary
 * in the commit path, the entire app unmounts to a blank white screen.
 *
 * These guards turn the two operations into safe no-ops when the node is no longer
 * where React expects (i.e. GT relocated it), instead of throwing. React's fiber
 * tree stays authoritative and self-corrects on the next render. Standard,
 * widely-deployed workaround for facebook/react#11538. Must run once, before React
 * mounts. Translation keeps working — only the crash is removed.
 */
export function installGoogleTranslateGuard(): void {
  if (typeof Node !== 'function' || !Node.prototype) return;

  const proto = Node.prototype as Node & { __rcTranslateGuarded?: boolean };
  if (proto.__rcTranslateGuarded) return; // idempotent under StrictMode / HMR
  proto.__rcTranslateGuarded = true;

  const originalRemoveChild = proto.removeChild;
  proto.removeChild = function <T extends Node>(this: Node, child: T): T {
    if (child.parentNode !== this) {
      // Google Translate already detached/replaced this node — nothing to remove.
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = proto.insertBefore;
  proto.insertBefore = function <T extends Node>(this: Node, newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      // Reference sibling was moved by Google Translate — append instead of
      // throwing so the new node still lands in the DOM (React reorders next render).
      return originalInsertBefore.call(this, newNode, null) as T;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}
