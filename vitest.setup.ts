/**
 * Unit tests never touch the network: Crustdata tests inject a fetch that serves checked-in captures
 * (src/test/crustdata.ts), and the key is removed from the test process unless CRUSTDATA_LIVE=1
 * (src/lib/crustdata/live.contract.test.ts — spends credits).
 */
if (process.env.CRUSTDATA_LIVE !== "1") {
  delete process.env.CRUSTDATA_API_KEY;
}
process.env.DEALDESK_GOOGLE_TOKEN_FILE = "off"; // never read a real local Google sign-in in tests
