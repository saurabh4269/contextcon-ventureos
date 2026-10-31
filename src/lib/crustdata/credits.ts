/** Documented fixture credit labels (see docs.crustdata.com/general/pricing). */
export const FIXTURE_CREDITS = {
  identify: "0",
  enrichCompany: "2",
  personEnrich: "1",
  webSearchLive: "1",
  watchCreate: "0",
  watchNotification: "5",
  jobSearchPerRow: "0.03",
  /** 0.03 base + 0.1 for filtering on experience; +0.1 more per row when `experience` is also returned. */
  personSearchFounderPerRow: "0.13",
  /** 0.03 base; premium groups (funding/headcount 0.2, taxonomy 0.1) add per row when filtered on or returned. */
  companySearchPerRow: "0.03",
} as const;
