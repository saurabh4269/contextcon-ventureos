"use client";
// Firm mandate + priors (GET/PUT /api/settings/mandate). Deal fit scores, the screener verdict, valuation and return
// multiples are computed from what is entered here; nothing is pre-filled.
import { MandateSettings } from "@/live/mandate";

export default function MandatePage() {
  return <MandateSettings />;
}
