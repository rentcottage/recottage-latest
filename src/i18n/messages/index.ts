import en, { type Messages } from './en';
import ka from './ka';
import ru from './ru';
import type { Lang } from '../config';

export type { Messages };

// en is typed as its literal shape; cast to Messages so all three share one type.
export const messages: Record<Lang, Messages> = {
  ka,
  en: en as Messages,
  ru,
};
