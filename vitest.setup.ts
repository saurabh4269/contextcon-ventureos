/**
 * Unit tests never touch the network: Crustdata tests inject a fetch that serves checked-in captures
 * (src/test/crustdata.ts), and the keys are removed from the test process unless CRUSTDATA_LIVE=1
 * (src/lib/crustdata/live.contract.test.ts — spends credits).
 */
if (process.env.CRUSTDATA_LIVE !== "1") {
  delete process.env.CRUSTDATA_API_KEY;
  delete process.env.CRUSTDATA_API_KEY_BACKUP; // server.ts falls back to it when the primary key is unset
}
