import { describe, expect, it } from "vitest";
import { banglishKey, bengaliForms, buildDictionary, expandQuery, expandWord, meiliSynonyms, normalizeText, tokenize } from "./synonyms";

describe("Bengali and Banglish spellings (US-045)", () => {
  it("expands Banglish to English and Bengali spellings, and back", () => {
    expect(expandWord("sharee")).toEqual(expect.arrayContaining(["sharee", "saree", "sari", "শাড়ি".normalize("NFC")]));
    expect(expandWord("boi")).toEqual(expect.arrayContaining(["boi", "book", "books", "বই"]));
    expect(expandWord("বই")).toEqual(expect.arrayContaining(["বই", "boi", "book"]));
    expect(expandWord("punjabi")).toEqual(expect.arrayContaining(["panjabi", "পাঞ্জাবি"]));
    expect(expandWord("jama")).toEqual(expect.arrayContaining(["shirt", "জামা"]));
    expect(expandWord("juta")).toEqual(expect.arrayContaining(["shoe", "জুতা"]));
    expect(expandWord("ghori")).toEqual(expect.arrayContaining(["watch", "ঘড়ি".normalize("NFC")]));
  });

  it("keeps the word as typed first", () => {
    expect(expandWord("Sharee")[0]).toBe("sharee");
    expect(expandWord("processor")[0]).toBe("processor");
  });

  it("finds a group from an unlisted Banglish spelling through the phonetic key", () => {
    expect(banglishKey("sharee")).toBe("sari");
    expect(banglishKey("shaari")).toBe("sari");
    // "shaaree" is not in the dictionary but sounds like "sari".
    expect(expandWord("shaaree")).toEqual(expect.arrayContaining(["saree", "শাড়ি".normalize("NFC")]));
  });

  it("leaves unknown words alone", () => {
    expect(expandWord("ryzen")).toEqual(["ryzen"]);
    expect(expandWord("  ")).toEqual([]);
  });

  it("matches both stored forms of Bengali letters with a nukta (ড় as one or two code points)", () => {
    const composed = "শাড়ি"; // শাড়ি with U+09DC
    const decomposed = "শাড়ি"; // শাড়ি with ড + nukta
    expect(bengaliForms(composed)).toEqual([decomposed, composed]);
    expect(expandWord(composed)).toEqual(expect.arrayContaining([decomposed, composed, "saree"]));
    expect(bengaliForms("hello")).toEqual(["hello"]);
  });

  it("expands a query word by word; every word must match through one alternative", () => {
    const terms = expandQuery("Cotton  sharee!");
    expect(terms).toHaveLength(2);
    expect(terms[0]).toEqual(expect.arrayContaining(["cotton", "suti"]));
    expect(terms[1]).toEqual(expect.arrayContaining(["sharee", "saree"]));
    expect(expandQuery("")).toEqual([]);
    expect(expandQuery("boi boi")).toHaveLength(1);
  });

  it("normalises case, punctuation and spacing but keeps Bengali marks", () => {
    expect(normalizeText("  G.Skill  RAM—16GB ")).toBe("g skill ram 16gb");
    expect(tokenize("পাঞ্জাবি, কুর্তা")).toEqual(["পাঞ্জাবি", "কুর্তা"]);
  });

  it("builds the Meilisearch synonyms setting (multi-way)", () => {
    const synonyms = meiliSynonyms([["boi", "book", "বই"]]);
    expect(synonyms.boi).toEqual(["book", "বই"]);
    expect(synonyms["বই"]).toEqual(["boi", "book"]);
    const all = meiliSynonyms();
    expect(all.sharee).toEqual(expect.arrayContaining(["saree", "sari"]));
  });

  it("accepts a custom dictionary", () => {
    const dict = buildDictionary([["mishti", "sweet", "মিষ্টি"]]);
    expect(expandWord("misti", dict)).toEqual(expect.arrayContaining(["sweet", "মিষ্টি"]));
  });
});
