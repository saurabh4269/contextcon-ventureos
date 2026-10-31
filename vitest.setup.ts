/**
 * Unit tests never touch the network: Crustdata runs on checked-in fixtures and the key is removed from the test
 * process, unless CRUSTDATA_LIVE=1 (src/lib/crustdata/live.contract.test.ts — spends credits).
 */
if (process.env.CRUSTDATA_LIVE !== "1") {
  process.env.CRUSTDATA_FORCE_FIXTURE = "1";
  delete process.env.CRUSTDATA_API_KEY;
}
