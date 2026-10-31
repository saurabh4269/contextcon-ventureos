/** Gmail search the inbox agent uses to find founder emails (read-only; GET /api/workflow/inbox). */
export const INBOX_QUERY = 'in:inbox newer_than:90d (pitch OR deck OR raising OR "data room" OR intro OR investment)';
