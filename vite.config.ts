import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'
import { writeFileSync } from 'node:fs'
import AutoImport from 'unplugin-auto-import/vite'
import { createClient } from '@supabase/supabase-js'
import { buildGroups, type LandingListing } from './src/lib/landingPages.ts'
import { buildListingSchema, type SchemaListing } from './src/lib/listingSchema.ts'
import { OG_BOX, optimizedImageUrl } from './src/lib/imageUrl.ts'

const base = process.env.BASE_PATH || '/'
const isPreview = process.env.IS_PREVIEW  ? true : false;

/**
 * Emits the /cottages/<slug> landing-page index for the post-build scripts.
 *
 * WHY IT LIVES HERE. The pages are grouped with regionMatches() and
 * canonicalCity() — real TypeScript in src/lib. scripts/prerender.mjs cannot
 * import TypeScript (it runs under whatever Node the deploy platform gives us,
 * with no type-stripping loader), and an approximation of regionMatches was
 * measured to disagree with it on 6 of 101 listings — listings that would have
 * landed on the wrong page or none at all. Vite loads THIS file through
 * esbuild, so here the real modules import natively on any Node. One grouping
 * implementation, no mirror to drift.
 *
 * The artifact is written to the repo root, not into dist/, so it is never
 * served. prerender.mjs renders it to HTML and generate-sitemap.mjs adds the
 * URLs; both treat a missing file as "no landing pages", which is what a build
 * without Supabase credentials produces.
 */
export const LANDING_INDEX = 'landing-groups.json'
/** Per-listing JSON-LD, keyed by listing id, for scripts/prerender.mjs. */
export const SCHEMA_INDEX = 'listing-schemas.json'
const SITE = 'https://rentcottage.ge'

function landingIndexPlugin(mode: string) {
  return {
    name: 'rentcottage-landing-index',
    apply: 'build' as const,
    async closeBundle() {
      const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }
      const url = env.VITE_PUBLIC_SUPABASE_URL
      const key = env.VITE_PUBLIC_SUPABASE_ANON_KEY
      if (!url || !key) {
        console.warn('⚠ No Supabase credentials; skipping the landing-page index.')
        writeFileSync(LANDING_INDEX, JSON.stringify({ groups: [] }, null, 0))
        writeFileSync(SCHEMA_INDEX, JSON.stringify({}, null, 0))
        return
      }
      const supabase = createClient(url, key, { auth: { persistSession: false } })
      // `.returns()` because the select list is a concatenated string, which
      // supabase-js cannot parse into a row type — without it every field
      // below is a GenericStringError to the compiler.
      const { data, error } = await supabase
        .from('public_properties')
        .select('id, title, location, address, description, price_per_night, max_guests, ' +
                'bedrooms, amenities, latitude, longitude, categories, cover_photo_url, photo_urls')
        .returns<(LandingListing & SchemaListing)[]>()
      if (error) throw new Error(`landing index: ${error.message}`)
      const rows = data ?? []

      // buildGroups() asserts slug uniqueness and throws on a collision, which
      // fails the build rather than letting one page overwrite another.
      const groups = buildGroups(rows)
      writeFileSync(LANDING_INDEX, JSON.stringify({ groups }, null, 0))
      console.log(`Landing index: ${groups.length} pages ` +
        `(${groups.filter(g => g.kind === 'region').length} region, ` +
        `${groups.filter(g => g.kind === 'city').length} city, ` +
        `${groups.filter(g => g.kind === 'category').length} category)`)

      // The listing structured data, built by the module the property page
      // itself calls. Emitting it here rather than in prerender.mjs is what
      // makes "the served JSON-LD and the hydrated JSON-LD are the same
      // object" a fact about the code instead of a hope.
      const schemas: Record<string, unknown> = {}
      for (const row of rows) {
        const first = [row.cover_photo_url, ...(Array.isArray(row.photo_urls) ? row.photo_urls : [])]
          .find((u: unknown) => typeof u === 'string' && u.trim())
        schemas[row.id] = buildListingSchema(row, {
          url: `${SITE}/property/${row.id}`,
          image: first ? optimizedImageUrl(first, OG_BOX, 75, 'cover') : `${SITE}/og-image.png`,
          // Nothing has reviews yet; when that changes this is the one place
          // the real count has to be read, and aggregateRating follows.
          reviews: 0,
          rating: null,
        })
      }
      writeFileSync(SCHEMA_INDEX, JSON.stringify(schemas, null, 0))
      console.log(`Listing schemas: ${Object.keys(schemas).length}`)
    },
  }
}
// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  define: {
   __BASE_PATH__: JSON.stringify(base),
   __IS_PREVIEW__: JSON.stringify(isPreview)
  },
  plugins: [react(),
    tailwindcss(),
    landingIndexPlugin(mode),
    AutoImport({
      imports: [
        {
          'react': [
            'React',
            'useState',
            'useEffect',
            'useContext',
            'useReducer',
            'useCallback',
            'useMemo',
            'useRef',
            'useImperativeHandle',
            'useLayoutEffect',
            'useDebugValue',
            'useDeferredValue',
            'useId',
            'useInsertionEffect',
            'useSyncExternalStore',
            'useTransition',
            'startTransition',
            'lazy',
            'memo',
            'forwardRef',
            'createContext',
            'createElement',
            'cloneElement',
            'isValidElement'
          ]
        },
        {
          'react-router-dom': [
            'useNavigate',
            'useLocation',
            'useParams',
            'useSearchParams',
            'Link',
            'NavLink',
            'Navigate',
            'Outlet'
          ]
        }
      ],
      dts: true,
    }),
  ],
  base,
  build: {
    sourcemap: true,
    outDir: 'dist',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@components': resolve(__dirname, './src/components'),
      '@hooks': resolve(__dirname, './src/hooks'),
      '@lib': resolve(__dirname, './src/lib'),
      '@pages': resolve(__dirname, './src/pages'),
      '@router': resolve(__dirname, './src/router'),
      '@i18n': resolve(__dirname, './src/i18n'),
      '@mocks': resolve(__dirname, './src/mocks'),
    }
  },
  server: {
    port: 3000,
    host: '0.0.0.0',
  }
}))
