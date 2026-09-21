import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import Header from '../../components/feature/Header';
import Footer from '../../components/feature/Footer';
import PropertyCard from '../../components/feature/PropertyCard';
import SEO from '../../components/feature/SEO';
import { useApprovedProperties } from '../../hooks/useApprovedProperties';
import { useT } from '../../i18n';
import { buildGroups, findGroup, type LandingListing } from '../../lib/landingPages';
import { localizePlace } from '../../lib/locationNormalizer';
import { OG_BOX, optimizedImageUrl } from '../../lib/imageUrl';

/**
 * /cottages/<slug> — the client half of the landing pages.
 *
 * The SERVED html for these URLs is written at build time by
 * scripts/prerender.mjs: Georgian copy, the cottages as plain <a href> links,
 * and the JSON-LD, so a crawler needs no JavaScript. This component is what a
 * reader gets once React takes over, and the reason it has to exist at all is
 * that without a route here the router's "*" case would replace a perfectly
 * good prerendered page with the 404 screen the moment it hydrated.
 *
 * The grouping is the same buildGroups() the build used, over the listings the
 * app has already loaded, so the set of cottages shown here is the set the
 * crawler saw.
 */
export default function CottagesLanding() {
  const { slug = '' } = useParams();
  const { t, plural, lang } = useT();
  const { dbProperties, loading } = useApprovedProperties();

  const group = useMemo(() => {
    if (!dbProperties.length) return undefined;
    const listings: LandingListing[] = dbProperties.map((p) => ({
      id: p.id,
      title: p.title,
      location: p.location,
      price_per_night: p.price,
      max_guests: p.maxGuests ?? null,
      bedrooms: p.bedrooms ?? null,
      categories: p.categories ?? [],
    }));
    return findGroup(buildGroups(listings), slug);
  }, [dbProperties, slug]);

  const shown = useMemo(
    () => (group ? dbProperties.filter((p) => group.listings.some((l) => l.id === p.id)) : []),
    [group, dbProperties],
  );

  const displayName = group
    ? (group.kind === 'category' ? group.key : localizePlace(group.key, lang))
    : slug;
  // Reuses the search page's own strings, so this heading reads correctly in
  // all three languages without adding a single new message key.
  const heading = group?.kind === 'category'
    ? t('search.categoryCottages', { category: displayName })
    : t('search.cottagesIn', { location: displayName });

  const cover = shown[0]?.image;

  return (
    <div className="min-h-screen bg-white">
      <SEO
        title={`${heading} — ${shown.length} | RentCottage.Ge`}
        description={plural('search.cottagesFoundCount', shown.length)}
        canonical={`/cottages/${slug}`}
        ogImage={cover ? optimizedImageUrl(cover, OG_BOX, 75, 'cover') : undefined}
      />
      <Header />

      <main className="max-w-[1280px] mx-auto px-4 sm:px-6 py-8 md:py-12">
        <nav className="text-sm text-soft mb-3">
          <Link to="/" className="hover:text-red-500">RentCottage.Ge</Link>
          <span className="mx-1.5">/</span>
          <Link to="/search" className="hover:text-red-500">{t('footer.search')}</Link>
        </nav>

        <h1 className="text-2xl md:text-4xl font-extrabold text-ink tracking-tight">{heading}</h1>
        {!loading && group && (
          <p className="text-soft mt-2">{plural('search.cottagesFoundCount', shown.length)}</p>
        )}

        {loading && <p className="text-soft mt-8">{t('common.loading')}</p>}

        {/* An unknown slug is not a 404: the URL is real, the page just has
            nothing to group. Send the reader to search rather than a dead end. */}
        {!loading && !group && (
          <div className="mt-10">
            <Link to="/search" className="text-red-500 font-semibold hover:text-red-600">
              {t('footer.search')}
            </Link>
          </div>
        )}

        {!loading && group && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 mt-7">
            {shown.map((p) => (
              <PropertyCard
                key={p.id}
                id={p.id}
                title={p.title}
                location={p.location}
                price={p.price}
                rating={p.rating}
                reviews={p.reviews}
                image={p.image}
                images={p.images}
                host={p.host}
                amenities={p.amenities}
                isRealListing={p.isRealListing}
                coverPosition={p.coverPosition}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
