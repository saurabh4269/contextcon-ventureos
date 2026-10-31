// Normalized live-data shapes returned by /api/live/* and /api/integrations/connectors.
// Pure types (no server imports) so client adapters can use them too. Field comments name the Crustdata source path.

export type Point = { date: string; v: number };

export type LiveCompany = {
  id: number; // crustdata_company_id
  name: string; // basic_info.name
  domain: string; // basic_info.primary_domain
  website?: string;
  logoUrl?: string; // basic_info.logo_permalink
  description?: string; // basic_info.description
  yearFounded?: number;
  employeeRange?: string; // basic_info.employee_count_range
  linkedinUrl?: string; // basic_info.professional_network_url
  hq?: string; // locations.headquarters
  country?: string; // locations.country
  industries: string[]; // taxonomy.professional_network_industries
  categories: string[]; // taxonomy.categories
  headcount: {
    total?: number; // headcount.total
    growth: { mom?: number; qoq?: number; six_months?: number; yoy?: number }; // headcount.growth_percent.*
    /** headcount.timeseries reduced to one point per month (last point of the month), oldest first, last 12 months. */
    monthly: Point[];
    /** headcount.by_function_timeseries.CURRENT_FUNCTION, top functions by latest count, monthly. */
    byFunction: { label: string; monthly: Point[] }[];
  };
  funding: {
    totalUsd?: number; // funding.total_investment_usd
    lastRoundType?: string; // funding.last_round_type
    lastRoundUsd?: number; // funding.last_round_amount_usd
    lastDate?: string; // funding.last_fundraise_date
    investors: string[]; // funding.investors
  };
  web: {
    domain?: string;
    monthlyVisitors?: number; // web_traffic.domain_traffic[domain].monthly_visitors
    momPct?: number;
    qoqPct?: number;
    monthly: Point[]; // …monthly_visitors_timeseries
  };
  news: { title: string; url?: string; date?: string; publisher?: string }[]; // news[].article_*
};

export type LiveEmployment = { company: string; title?: string; start?: string; end?: string; companyId?: number; companyDomain?: string };

export type LivePerson = {
  id?: number; // crustdata_person_id
  name: string;
  title?: string; // basic_profile.current_title
  headline?: string;
  location?: string;
  linkedinUrl?: string; // social_handles.professional_network_identifier.profile_url
  pictureUrl?: string;
  current: LiveEmployment[]; // experience.employment_details.current
  past: LiveEmployment[]; // experience.employment_details.past
  schools: { school: string; degree?: string; field?: string; start?: number; end?: number }[]; // education.schools
};

export type LiveJobs = {
  total: number; // total_count
  listings: { title: string; category?: string; url?: string; date?: string; location?: string }[];
  /** Category counts over the returned listings (most recent `listings.length` roles, not all `total`). */
  byCategory: { category: string; count: number }[];
};

export type LiveNews = { query: string; results: { title: string; url?: string; snippet?: string; source?: string }[] };

export type LiveComp = {
  id: number;
  name: string;
  domain?: string;
  description?: string;
  yearFounded?: number;
  employeeRange?: string;
  totalUsd?: number;
  lastRoundType?: string;
};

/** One upstream call as the UI shows it in the signal graph. */
export type LiveCall<T = unknown> = {
  id: "identify" | "enrich" | "founders" | "jobs" | "news" | "comps" | "person";
  method: "GET" | "POST";
  path: string;
  body: unknown;
  status: "ok" | "no_match" | "error" | "skipped";
  /** observed latency of the original network call (cache hits report the original latency) */
  ms: number;
  cached: boolean;
  creditsUsed: string | null;
  error?: string;
  /** why a call was skipped (e.g. "no description to search on") */
  note?: string;
  data?: T;
};

export type LiveFailure =
  | { status: "not_connected"; message: string }
  | { status: "disabled"; message: string }
  | { status: "error"; message: string; upstreamStatus?: number };

export type IdentifyData = { id: number; name: string; confidence?: number; matchType?: string };

export type ResearchResult =
  | {
      status: "ok";
      domain: string;
      requestedAt: string;
      company: LiveCompany;
      calls: {
        identify: LiveCall<IdentifyData>;
        enrich: LiveCall<LiveCompany>;
        founders: LiveCall<{ total: number; people: LivePerson[] }>;
        jobs: LiveCall<LiveJobs>;
        news: LiveCall<LiveNews>;
        comps: LiveCall<LiveComp[]>;
      };
    }
  | { status: "no_match"; domain: string; requestedAt: string; calls: { identify: LiveCall } }
  | LiveFailure;

export type CompanyLookup = { status: "ok"; company: LiveCompany; identify: LiveCall<IdentifyData>; enrich: LiveCall<LiveCompany> } | { status: "no_match"; domain: string; identify: LiveCall } | LiveFailure;

export type PersonLookup = { status: "ok"; person: LivePerson; call: LiveCall } | { status: "no_match"; linkedinUrl: string; call: LiveCall } | LiveFailure;

/* ── connectors (GET /api/integrations/connectors) — see docs/API.md ── */
export type IntegrationStatus = "connected" | "not_configured" | "error" | "demo";
export type IntegrationInfo = {
  id: string;
  name: string;
  status: IntegrationStatus;
  /** how the status was established: a live health call, env inspection only, or fixture/dry-run config */
  mode: "live_check" | "env" | "fixture";
  /** true when this build actually calls the integration (Crustdata only, today) */
  wired: boolean;
  detail: string;
  /** env vars that configure it (names only, never values) */
  env: string[];
  docsUrl: string;
  lastCheckedAt: string | null;
};
export type IntegrationsResponse = { dataMode: "demo" | "live"; checkedAt: string; connectors: IntegrationInfo[] };
