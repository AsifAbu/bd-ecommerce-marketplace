/**
 * US-045: Bengali and Banglish spellings. Each group lists words that mean the same thing to a
 * shopper; a query word from a group also matches every other word of the group. Used by both
 * adapters: as the Meilisearch `synonyms` setting and as query expansion in the Postgres adapter.
 * Keep entries lower case. Add groups as real search logs show what shoppers type.
 */
export const SYNONYM_GROUPS: readonly (readonly string[])[] = [
  // Clothing
  ["saree", "sari", "sharee", "shari", "shaari", "শাড়ি", "শাড়ী"],
  ["panjabi", "punjabi", "panjabee", "punjabee", "পাঞ্জাবি", "পাঞ্জাবী"],
  ["shirt", "shirts", "shart", "jama", "শার্ট", "জামা"],
  ["pant", "pants", "trouser", "trousers", "প্যান্ট"],
  ["jeans", "denim", "জিন্স"],
  ["kurti", "kurta", "কুর্তি", "কুর্তা"],
  ["lungi", "lungee", "লুঙ্গি"],
  ["tops", "top", "টপস"],
  ["cotton", "suti", "sutti", "সুতি"],
  ["shoe", "shoes", "juta", "jutta", "jooto", "জুতা", "জুতো"],
  ["sandal", "sandals", "sandel", "স্যান্ডেল"],
  ["gamcha", "gamchha", "gamsa", "গামছা"],
  // Books and stationery
  ["book", "books", "boi", "বই"],
  ["novel", "uponnash", "uponyas", "upanyas", "উপন্যাস"],
  ["poem", "poetry", "kobita", "kabita", "কবিতা"],
  ["pen", "kolom", "kalam", "কলম"],
  ["notebook", "khata", "khaata", "খাতা"],
  // Electronics
  ["watch", "ghori", "ghodi", "ghari", "ঘড়ি"],
  ["mobile", "phone", "fone", "ফোন", "মোবাইল"],
  ["processor", "cpu", "প্রসেসর"],
  ["ram", "র‍্যাম", "র্যাম"],
  ["motherboard", "mobo", "মাদারবোর্ড"],
  ["laptop", "ল্যাপটপ"],
  ["fan", "pakha", "ফ্যান", "পাখা"],
  ["charger", "চার্জার"],
  // Health
  ["medicine", "oshudh", "oushudh", "osudh", "oshud", "ওষুধ", "ঔষধ"],
  ["tablet", "tablets", "trablet", "ট্যাবলেট"],
  ["vitamin", "vitamins", "bhitamin", "ভিটামিন"],
  ["paracetamol", "napa", "প্যারাসিটামল"],
  // Home
  ["bag", "bags", "beg", "ব্যাগ"],
  ["bottle", "botol", "বোতল"],
  ["glasses", "chosma", "choshma", "chashma", "চশমা"],
];

/** Bengali letters with a nukta have a composed and a decomposed form; NFC keeps the decomposed one. */
const NUKTA_COMPOSED: [string, string][] = [
  ["ড়", "ড়"], // ড় (rra)
  ["ঢ়", "ঢ়"], // ঢ় (rha)
  ["য়", "য়"], // য় (yya)
];

const BENGALI = /[ঀ-৿]/;
const LATIN = /^[a-z0-9]+$/;

/** Lower case, NFC, Bengali-aware: keeps letters, digits, Bengali marks and joiners; the rest is a separator. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{M}‌‍]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function tokenize(text: string): string[] {
  const normalized = normalizeText(text);
  return normalized ? normalized.split(" ") : [];
}

/** Both stored forms of a Bengali word (composed and decomposed nukta letters). */
export function bengaliForms(word: string): string[] {
  if (!BENGALI.test(word)) return [word];
  const decomposed = word.normalize("NFC");
  let composed = decomposed;
  for (const [from, to] of NUKTA_COMPOSED) composed = composed.split(from).join(to);
  return composed === decomposed ? [decomposed] : [decomposed, composed];
}

/**
 * A rough phonetic key for Banglish (Latin-script Bengali) so close spellings meet:
 * "sharee", "shaari", "shari" and "sari" all become "sari", so a spelling the dictionary does not list
 * still finds its group.
 */
export function banglishKey(word: string): string {
  if (!LATIN.test(word)) return word;
  return word
    .replace(/sh/g, "s")
    .replace(/ph/g, "f")
    .replace(/bh/g, "b")
    .replace(/dh/g, "d")
    .replace(/th/g, "t")
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .replace(/ch/g, "c")
    .replace(/w/g, "u")
    .replace(/ee|ea|ie/g, "i")
    .replace(/oo|ou/g, "u")
    .replace(/([a-z])\1+/g, "$1");
}

interface Dictionary {
  byWord: Map<string, Set<string>>;
  byKey: Map<string, Set<string>>;
}

function buildDictionary(groups: readonly (readonly string[])[]): Dictionary {
  const byWord = new Map<string, Set<string>>();
  const byKey = new Map<string, Set<string>>();
  for (const group of groups) {
    const words = group.map((w) => normalizeText(w)).filter(Boolean);
    for (const word of words) {
      for (const [map, key] of [
        [byWord, word],
        [byKey, banglishKey(word)],
      ] as const) {
        const set = map.get(key) ?? new Set<string>();
        for (const w of words) set.add(w);
        map.set(key, set);
      }
    }
  }
  return { byWord, byKey };
}

const DEFAULT_DICTIONARY = buildDictionary(SYNONYM_GROUPS);

/** Most alternatives kept per query word (the original word always comes first). */
export const MAX_ALTERNATIVES = 12;

/** The word itself plus every spelling it stands for, in both Bengali forms. */
export function expandWord(word: string, dictionary: Dictionary = DEFAULT_DICTIONARY): string[] {
  const normalized = normalizeText(word);
  if (!normalized) return [];
  const found = dictionary.byWord.get(normalized) ?? dictionary.byKey.get(banglishKey(normalized));
  const words = [normalized, ...(found ? [...found].filter((w) => w !== normalized) : [])];
  const out: string[] = [];
  for (const w of words) for (const form of bengaliForms(w)) if (!out.includes(form)) out.push(form);
  return out.slice(0, MAX_ALTERNATIVES);
}

/**
 * Query expansion: one list of alternatives per query word. A product matches when every word
 * matches through at least one of its alternatives.
 */
export function expandQuery(q: string, dictionary?: Dictionary): string[][] {
  const words = [...new Set(tokenize(q))].slice(0, 10);
  return words.map((w) => expandWord(w, dictionary)).filter((alts) => alts.length > 0);
}

/** The Meilisearch `synonyms` setting: every word of a group maps to the others (multi-way). */
export function meiliSynonyms(groups: readonly (readonly string[])[] = SYNONYM_GROUPS): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const group of groups) {
    const words = [...new Set(group.flatMap((w) => bengaliForms(normalizeText(w))))].filter(Boolean);
    for (const word of words) {
      const others = words.filter((w) => w !== word);
      out[word] = [...new Set([...(out[word] ?? []), ...others])];
    }
  }
  return out;
}

export { buildDictionary };
