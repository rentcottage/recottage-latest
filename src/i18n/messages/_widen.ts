// Widen literal leaf types (produced by `as const`) to `string`, so ka/ru
// catalogs may supply their own text while still being required to match the
// English namespace's exact key structure at compile time.
export type Widen<T> = { [K in keyof T]: T[K] extends string ? string : Widen<T[K]> };
