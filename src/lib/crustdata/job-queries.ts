export function jobSearchByCompanyId(crustdataCompanyId: number, limit = 25) {
  return {
    filters: {
      field: "company.basic_info.company_id",
      type: "=",
      value: crustdataCompanyId,
    },
    sorts: [{ field: "metadata.date_added", order: "desc" as const }],
    limit,
  };
}

export type JobListingRow = {
  job_details?: { title?: string; category?: string; url?: string };
};

export function readJobSearchResults(data: {
  job_listings?: JobListingRow[];
  total_count?: number;
}): { listings: JobListingRow[]; totalCount: number } {
  const listings = data.job_listings ?? [];
  return { listings, totalCount: data.total_count ?? listings.length };
}

export function companyIdFromJobSearchBody(body: Record<string, unknown>): number | undefined {
  const filters = body.filters as { field?: string; value?: unknown } | undefined;
  if (filters?.field === "company.basic_info.company_id" && typeof filters.value === "number") {
    return filters.value;
  }
  return undefined;
}
