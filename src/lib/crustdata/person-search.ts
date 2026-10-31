import type { PersonSearchResponse } from "./types";

type Employment = { name?: string | null; title?: string | null; start_date?: string | null; end_date?: string | null };
type AnyPerson = {
  basic_info?: { name?: string };
  basic_profile?: { name?: string };
  /** builder's legacy hand-written fixtures */
  employment_history?: Array<{ company_name: string; start_date?: string; end_date?: string | null }>;
  /** live API shape */
  experience?: { employment_details?: { current?: Employment[] | null; past?: Employment[] | null } | null } | null;
};

/**
 * Normalize person search rows to `{ name, employment_history }`.
 * Live responses use `profiles[].experience.employment_details.{current,past}[]` with the company in `name`; the builder's
 * normalizer only read the legacy fixture field `employment_history`, so live work history was always empty.
 */
export function normalizePersonSearchResults(data: PersonSearchResponse | { profiles?: AnyPerson[]; results?: AnyPerson[] }) {
  const d = data as { profiles?: AnyPerson[]; results?: AnyPerson[] };
  const list = d.profiles ?? d.results ?? [];
  return list.map((p) => {
    const ed = p.experience?.employment_details;
    const live = [...(ed?.current ?? []), ...(ed?.past ?? [])]
      .filter((e) => e.name)
      .map((e) => ({ company_name: e.name as string, start_date: e.start_date ?? undefined, end_date: e.end_date ?? null }));
    return {
      name: p.basic_profile?.name ?? p.basic_info?.name ?? "Unknown",
      employment_history: live.length ? live : (p.employment_history ?? []),
    };
  });
}

export function personNamesFromSearch(data: Parameters<typeof normalizePersonSearchResults>[0]): string[] {
  return normalizePersonSearchResults(data).map((p) => p.name);
}
