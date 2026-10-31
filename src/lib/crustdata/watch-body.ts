export function buildWatchCompanyBody(input: {
  crustdataCompanyId: number;
  webhookUrl: string;
}) {
  return {
    entities: { crustdata_company_ids: [input.crustdataCompanyId] },
    track: {
      op: "or",
      conditions: [
        { field: "headcount.total", type: "changed" },
        { field: "funding.last_round_type", type: "changed" },
        { field: "news", type: "added" },
      ],
    },
    config: {
      trigger: { type: "interval", every_hours: 24 },
      max_results_per_run: 5,
    },
    notifications: [{ type: "webhook", url: input.webhookUrl }],
    fields: ["basic_info", "headcount", "funding", "news"],
  };
}
