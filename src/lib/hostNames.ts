/**
 * Host names in the reader's script.
 *
 * Hosts type their own name at registration, so the same field holds Georgian
 * script for some and Latin for others. "Hosted by მარიამი ა." reads as broken
 * to an English visitor, and "Hosted by Giorgi C." reads the same way in
 * Georgian — the name has to follow the language like the rest of the page.
 *
 * A person's name is not a UI string, so this errs on the side of leaving it
 * alone. Two rules keep it honest:
 *
 *  - Georgian → Latin is a settled romanization, so an unrecognised Georgian
 *    name is transliterated letter by letter rather than left in a script the
 *    reader cannot read.
 *  - Latin → Georgian is NOT reversible: Latin `t` is either თ or ტ, `k` either
 *    ქ or კ, `p` either ფ or პ. Guessing would misspell a real person's name,
 *    so only names in the table below are converted; anything else is shown
 *    exactly as the host wrote it.
 */

/** Mkhedruli → Latin, the Georgian national romanization. */
const KA_TO_LATIN: Record<string, string> = {
  ა: 'a', ბ: 'b', გ: 'g', დ: 'd', ე: 'e', ვ: 'v', ზ: 'z', თ: 't', ი: 'i',
  კ: 'k', ლ: 'l', მ: 'm', ნ: 'n', ო: 'o', პ: 'p', ჟ: 'zh', რ: 'r', ს: 's',
  ტ: 't', უ: 'u', ფ: 'p', ქ: 'k', ღ: 'gh', ყ: 'q', შ: 'sh', ჩ: 'ch', ც: 'ts',
  ძ: 'dz', წ: 'ts', ჭ: 'ch', ხ: 'kh', ჯ: 'j', ჰ: 'h',
};

/**
 * Georgian personal names and their conventional Latin spellings.
 *
 * Every Georgian and Latin host name currently on the platform is covered,
 * plus common names new hosts are likely to enter. Conventional spelling wins
 * over strict transliteration — Davit, not Daviti.
 */
const NAME_PAIRS: [string, string][] = [
  ['ანა', 'Ana'], ['ანი', 'Ani'], ['ალექსანდრე', 'Aleksandre'], ['ბადრი', 'Badri'],
  ['ბექა', 'Beqa'], ['ბესარიონ', 'Besarion'], ['ბიძინა', 'Bidzina'], ['გელა', 'Gela'],
  ['გენო', 'Geno'], ['გივი', 'Givi'], ['გიორგი', 'Giorgi'], ['გოჩა', 'Gocha'],
  ['გურამ', 'Guram'], ['დავით', 'Davit'], ['დათა', 'Data'], ['დათო', 'Dato'],
  ['დიმიტრი', 'Dimitri'], ['ეკა', 'Eka'], ['ელენე', 'Elene'], ['ელიზბარ', 'Elizbar'],
  ['ელისაბედ', 'Elisabed'], ['ვაკა', 'Vaka'], ['ვანო', 'Vano'], ['ვაჟა', 'Vazha'],
  ['ვახტანგ', 'Vakhtang'], ['ზაზა', 'Zaza'], ['ზაირა', 'Zaira'], ['ზურაბ', 'Zurab'],
  ['თაკო', 'Tako'], ['თამარ', 'Tamar'], ['თამთა', 'Tamta'], ['თამუნა', 'Tamuna'],
  ['თათია', 'Tatia'], ['თეა', 'Tea'], ['თემურ', 'Temur'], ['თეო', 'Teo'],
  ['თეონა', 'Teona'], ['თეთე', 'Tete'], ['თინა', 'Tina'], ['თინათინ', 'Tinatin'],
  ['თორნიკე', 'Tornike'], ['ინდირა', 'Indira'], ['ირაკლი', 'Irakli'], ['ირინა', 'Irina'],
  ['კახა', 'Kakha'], ['ლალი', 'Lali'], ['ლაშა', 'Lasha'], ['ლაურა', 'Laura'],
  ['ლერი', 'Leri'], ['ლევან', 'Levan'], ['ლიკა', 'Lika'], ['ლორენა', 'Lorena'],
  ['მაია', 'Maia'], ['მაიკო', 'Maiko'], ['მამუკა', 'Mamuka'], ['მანანა', 'Manana'],
  ['მანჩო', 'Mancho'], ['მარიამ', 'Mariam'], ['მარიამი', 'Mariami'], ['მარინა', 'Marina'],
  ['მზია', 'Mzia'], ['მირანდა', 'Miranda'], ['ნათია', 'Natia'], ['ნანა', 'Nana'],
  ['ნატო', 'Nato'], ['ნიკა', 'Nika'], ['ნიკოლოზ', 'Nikoloz'], ['ნინო', 'Nino'],
  ['ნუგზარ', 'Nugzar'], ['ომარ', 'Omar'], ['ოთარ', 'Otar'], ['პაატა', 'Paata'],
  ['ქეთი', 'Keti'], ['ქეთევან', 'Ketevan'], ['რევაზ', 'Revaz'], ['რომან', 'Roman'],
  ['საბა', 'Saba'], ['სალომე', 'Salome'], ['სერგო', 'Sergo'], ['სოსო', 'Soso'],
  ['სოფო', 'Sopo'], ['ტიტა', 'Tita'], ['ფატი', 'Pati'], ['ქეთინო', 'Ketino'],
  ['ხატია', 'Khatia'], ['შოთა', 'Shota'], ['ციცინო', 'Tsitsino'],
];

/** Other Latin spellings hosts actually use for the same names. */
const LATIN_ALIASES: [string, string][] = [
  ['David', 'დავით'], ['Davide', 'დავით'], ['Dato', 'დათო'], ['Beka', 'ბექა'],
  ['Anna', 'ანა'], ['George', 'გიორგი'], ['Giorgy', 'გიორგი'], ['Gio', 'გიო'],
  ['Ketevani', 'ქეთევან'], ['Maryam', 'მარიამ'], ['Mari', 'მარი'],
  ['Nikolozi', 'ნიკოლოზ'], ['Sofo', 'სოფო'], ['Sophie', 'სოფო'],
  ['Tamari', 'თამარ'], ['Vakho', 'ვახტანგ'], ['Nato', 'ნატო'], ['Nana', 'ნანა'],
];

/**
 * Latin initials whose Georgian letter is unambiguous. `t`, `k`, `p`, `c` and
 * `j` are deliberately absent: each maps to two Georgian letters, and a wrong
 * one misspells someone's surname.
 */
const LATIN_INITIAL_TO_KA: Record<string, string> = {
  a: 'ა', b: 'ბ', d: 'დ', e: 'ე', g: 'გ', i: 'ი', l: 'ლ', m: 'მ',
  n: 'ნ', o: 'ო', r: 'რ', s: 'ს', u: 'უ', v: 'ვ', z: 'ზ',
};

const KA_TO_LATIN_NAME = new Map(NAME_PAIRS.map(([ka, latin]) => [ka, latin]));
const LATIN_TO_KA_NAME = new Map<string, string>([
  ...NAME_PAIRS.map(([ka, latin]) => [latin.toLowerCase(), ka] as [string, string]),
  ...LATIN_ALIASES.map(([latin, ka]) => [latin.toLowerCase(), ka] as [string, string]),
]);

const GEORGIAN_SCRIPT = /[Ⴀ-ჿ]/;

/** Letter-by-letter romanization, for Georgian names not in the table. */
function romanize(word: string): string {
  const out = [...word].map((ch) => KA_TO_LATIN[ch] ?? ch).join('');
  return out.charAt(0).toUpperCase() + out.slice(1);
}

/** One word — a given name, or a single-letter surname initial. */
function localizeWord(word: string, toGeorgian: boolean): string {
  // Keep trailing punctuation ("ა." → "A.") attached to whatever we return.
  const match = word.match(/^(.*?)([.,]*)$/);
  const core = match?.[1] ?? word;
  const suffix = match?.[2] ?? '';
  if (!core) return word;

  const isGeorgian = GEORGIAN_SCRIPT.test(core);

  if (toGeorgian) {
    if (isGeorgian) return word;
    const known = LATIN_TO_KA_NAME.get(core.toLowerCase());
    if (known) return known + suffix;
    // A surname initial has no name to look up, so it is converted only where
    // the Latin letter has exactly one Georgian counterpart.
    if (core.length === 1) {
      const letter = LATIN_INITIAL_TO_KA[core.toLowerCase()];
      if (letter) return letter + suffix;
    }
    // No guessing beyond that: an unlisted Latin name stays exactly as the host
    // wrote it — Latin `t`/`k`/`p` each map to two Georgian letters.
    return word;
  }

  if (!isGeorgian) return word;
  const known = KA_TO_LATIN_NAME.get(core);
  if (known) return known + suffix;
  return romanize(core) + suffix;
}

/**
 * A host's display name written in the reader's script.
 *
 * Russian falls through to Latin: there is no Cyrillic name list, and a
 * transliterated name is far more use to a Russian reader than Georgian script.
 */
export function localizeHostName(name: string, lang: string): string {
  if (!name) return name;
  const toGeorgian = lang === 'ka';
  return name.split(/(\s+)/).map((part) => (/^\s+$/.test(part) ? part : localizeWord(part, toGeorgian))).join('');
}
