// Example requests for the Sourcing agent (request box chips, assistant dock, /ask). The deck's request comes first.
export const AGENT_EXAMPLES: { short: string; q: string }[] = [
  { short: "Indian B2B software, team +50%", q: "Find ten Indian B2B software companies founded since 2023 whose team grew by half in the last six months, and tell me who founded each and what they did before." },
  { short: "Bengaluru fintech, seed", q: "fintech startups in Bangalore at seed stage, with their founders" },
  { short: "US devtools doubling headcount", q: "top 8 US developer tools startups founded after 2021 that doubled headcount in the last year" },
  { short: "SEA AI, 20–200 people", q: "a dozen AI companies in Southeast Asia with 20-200 employees growing 30%+ in 6 months" },
];
