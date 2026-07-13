import { useEffect } from 'react';
import { useTranslation } from '@lib/i18n';

/** Open Graph locale tags for each supported UI language. */
const OG_LOCALES: Record<string, string> = {
  en: 'en_US',
  ka: 'ka_GE',
  ru: 'ru_RU',
  de: 'de_DE',
  fr: 'fr_FR',
};

interface SEOProps {
  title: string;
  description: string;
  keywords?: string;
  canonical?: string;
  noIndex?: boolean;
  jsonLd?: object | object[];
  ogType?: string;
  ogImage?: string;
}

export default function SEO({
  title,
  description,
  keywords,
  canonical,
  noIndex = false,
  jsonLd,
  ogType = 'website',
  ogImage = 'https://rentcottage.ge/og-image.png',
}: SEOProps) {
  const { lang } = useTranslation();
  const ogLocale = OG_LOCALES[lang] ?? 'en_US';
  const siteUrl = import.meta.env.VITE_SITE_URL || 'https://rentcottage.ge';
  const canonicalUrl = canonical ? `${siteUrl}${canonical}` : siteUrl;
  const schemas = jsonLd ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd]) : [];

  useEffect(() => {
    // Title
    document.title = title;

    const setMeta = (selector: string, content: string) => {
      let el = document.querySelector(selector) as HTMLMetaElement | null;
      if (!el) {
        el = document.createElement('meta');
        const attr = selector.startsWith('meta[name')
          ? 'name'
          : selector.startsWith('meta[property')
          ? 'property'
          : 'name';
        const val = selector.match(/["']([^"']+)["']/)?.[1] ?? '';
        el.setAttribute(attr, val);
        document.head.appendChild(el);
      }
      el.setAttribute('content', content);
    };

    const setLink = (rel: string, href: string) => {
      let el = document.querySelector(`link[rel="${rel}"]`) as HTMLLinkElement | null;
      if (!el) {
        el = document.createElement('link');
        el.setAttribute('rel', rel);
        document.head.appendChild(el);
      }
      el.setAttribute('href', href);
    };

    // Basic meta
    setMeta('meta[name="description"]', description);
    if (keywords) setMeta('meta[name="keywords"]', keywords);
    setMeta('meta[name="robots"]', noIndex ? 'noindex, nofollow' : 'index, follow');
    setMeta('meta[name="last-modified"]', new Date().toISOString().split('T')[0]);

    // Canonical
    setLink('canonical', canonicalUrl);

    // Open Graph
    setMeta('meta[property="og:title"]', title);
    setMeta('meta[property="og:description"]', description);
    setMeta('meta[property="og:type"]', ogType);
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[property="og:image"]', ogImage);
    setMeta('meta[property="og:site_name"]', 'RentCottage.Ge');
    setMeta('meta[property="og:locale"]', ogLocale);

    // Twitter
    setMeta('meta[name="twitter:card"]', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', title);
    setMeta('meta[name="twitter:description"]', description);
    setMeta('meta[name="twitter:image"]', ogImage);

    // JSON-LD — remove old page-specific scripts, inject new ones
    document.querySelectorAll('script[data-seo-jsonld]').forEach((s) => s.remove());
    schemas.forEach((schema) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.setAttribute('data-seo-jsonld', 'true');
      script.textContent = JSON.stringify(schema);
      document.head.appendChild(script);
    });
  }, [title, description, keywords, canonical, noIndex, ogType, ogImage, ogLocale, canonicalUrl, schemas]);

  return null;
}
