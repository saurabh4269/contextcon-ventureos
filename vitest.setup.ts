/**
 * Unit tests never touch the network: Crustdata tests inject a fetch that serves checked-in captures
 * (src/test/crustdata.ts), and the keys are removed from the test process unless CRUSTDATA_LIVE=1
 * (src/lib/crustdata/live.contract.test.ts — spends credits).
 */
if (process.env.CRUSTDATA_LIVE !== "1") {
  delete process.env.CRUSTDATA_API_KEY;
  delete process.env.CRUSTDATA_API_KEY_BACKUP; // server.ts falls back to it when the primary key is unset
}
process.env.DEALDESK_GOOGLE_TOKEN_FILE = "off"; // never read a real local Google sign-in in tests
// Server state (review queue, stages, workflows, mandate, memory) stays in process memory: tests never write .cache/
// files or reach a database. A test that needs files or Postgres builds that store itself.
process.env.DEALDESK_STORE = "memory";
delete process.env.DATABASE_URL;
delete process.env.POSTGRES_URL;
delete process.env.MANDATE_JSON;
