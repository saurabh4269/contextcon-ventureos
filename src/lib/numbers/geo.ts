// Country names and codes → one key, so mandate "US" matches Crustdata's "USA" / "United States" and "IN" matches "India".
import { norm } from "./text";

const COUNTRIES: string[][] = [
  ["us", "usa", "u s", "u s a", "united states", "united states of america", "america"],
  ["gb", "uk", "u k", "united kingdom", "great britain", "britain", "england"],
  ["in", "ind", "india"],
  ["ae", "uae", "united arab emirates"],
  ["de", "deu", "germany"],
  ["fr", "fra", "france"],
  ["ca", "can", "canada"],
  ["au", "aus", "australia"],
  ["sg", "sgp", "singapore"],
  ["cn", "chn", "china"],
  ["jp", "jpn", "japan"],
  ["il", "isr", "israel"],
  ["br", "bra", "brazil"],
  ["nl", "nld", "netherlands", "the netherlands"],
  ["se", "swe", "sweden"],
  ["ch", "che", "switzerland"],
  ["es", "esp", "spain"],
  ["it", "ita", "italy"],
  ["ie", "irl", "ireland"],
  ["kr", "kor", "south korea", "korea"],
  ["id", "idn", "indonesia"],
  ["mx", "mex", "mexico"],
  ["ng", "nga", "nigeria"],
  ["za", "zaf", "south africa"],
  ["ke", "ken", "kenya"],
  ["eg", "egy", "egypt"],
];
const BY_ALIAS = new Map(COUNTRIES.flatMap((names) => names.map((a) => [a, names[0]!] as const)));

/** Canonical key of a country name/code, or undefined when it is not a known country. */
export const canonCountry = (s: string): string | undefined => BY_ALIAS.get(norm(s));
