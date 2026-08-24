import { useNavigate, type NavigateFunction } from "react-router-dom";
import { useRoutes, useLocation, useNavigationType } from "react-router-dom";
import { useEffect } from "react";
import routes from "./config";

let navigateResolver: (navigate: ReturnType<typeof useNavigate>) => void;

declare global {
  interface Window {
    REACT_APP_NAVIGATE: ReturnType<typeof useNavigate>;
  }
}

export const navigatePromise = new Promise<NavigateFunction>((resolve) => {
  navigateResolver = resolve;
});

/**
 * Start each new page at the top.
 *
 * Nothing reset the scroll position on navigation, so moving between two pages
 * with the same shape — login → register especially — left the viewport exactly
 * where it was and looked as though the click had done nothing. Lazy routes make
 * it worse: the Suspense fallback is only one screen tall, so the document
 * briefly shrinks, the browser clamps the scroll offset, and the new page lands
 * at an arbitrary position.
 *
 * POP (browser Back/Forward) is left alone so returning to a list keeps the
 * place you were reading — see the paged search results.
 */
function useScrollToTopOnNavigate() {
  const { pathname } = useLocation();
  const navigationType = useNavigationType();

  useEffect(() => {
    if (navigationType === "POP") return;
    window.scrollTo(0, 0);
  }, [pathname, navigationType]);
}

export function AppRoutes() {
  const element = useRoutes(routes);
  const navigate = useNavigate();

  useScrollToTopOnNavigate();

  useEffect(() => {
    if (!window.REACT_APP_NAVIGATE) {
      window.REACT_APP_NAVIGATE = navigate;
      navigateResolver(window.REACT_APP_NAVIGATE);
    }
  });

  return element;
}
