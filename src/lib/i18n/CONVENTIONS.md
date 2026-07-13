# i18n conventions (RentCottage)

Custom lightweight engine under `src/lib/i18n/`. Read this before adding strings.

## Using translations in a component

```tsx
import { useTranslation } from '@lib/i18n'; // or relative: '../../lib/i18n'

function MyComponent() {
  const { t, lang, setLang } = useTranslation();
  return <h1>{t('namespace.key')}</h1>;
}
```

- `t('a.b.c')` resolves a dot path in the active locale, falling back to English,
  then to the raw key. Missing keys warn once in dev.
- Interpolation: `t('booking.total', { count: 3, price: '₾450' })` replaces
  `{count}` / `{price}` tokens in the string.
- Pluralization: author the leaf with `plural({ one, other })` (en/ka/de/fr) or
  `plural({ one, few, many, other })` (ru). Pass a numeric `count`:
  `t('common.nights', { count: n })`.

## Adding strings

1. Add the key to **`locales/en.ts`** first — it is the source-of-truth schema
   (`TranslationSchema = typeof en`).
2. Add the SAME key to all four other locales: `ka.ts`, `ru.ts`, `de.ts`, `fr.ts`.
   TypeScript fails the build if any locale is missing/extra a key.
3. Namespaces = app areas. Existing: `common`, `languageSelector`, `header`,
   `footer`, `notFound`, `errorBoundary`. Add new ones per area: `home`,
   `search`, `property`, `booking`, `auth`, `profile`, `host`, `admin`,
   `amenities`, `categories`, `propertyType`, …
4. Reuse `common.*` for generic words (Save, Cancel, Close, Loading…) and
   `header.nav.*` for the primary nav labels — don't duplicate them per page.

## What NOT to translate

- Brand token `RentCottage.Ge` (keep `translate="no"` + `notranslate`).
- Currency amounts / `₾` numbers, emails, URLs, icon class names.
- User-generated DB content (property title/description, review text, host names).
- Fixed-vocabulary DB fields (amenities, categories, property_type) ARE
  translated — via the `amenities` / `categories` / `propertyType` namespaces and
  a mapping helper (see `locales/fixedVocab.ts` once created).

## Languages

`en` English · `ka` ქართული · `ru` Русский · `de` Deutsch · `fr` Français.
Default = `ka` (persisted in `localStorage('rc_lang')`).

## Verify

`npx tsc --noEmit` must be clean (guarantees all 5 locales share one schema).
