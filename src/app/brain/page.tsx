"use client";
// Firm brain: derived memories/thesis need the backend; the raw organizational memory is live here (with notes).
import { UnavailablePage } from "@/live/unavailable";
import { MemoryPanel } from "@/live/memory";

export default function Brain() {
  return (
    <UnavailablePage screen="brain" active="brain">
      <MemoryPanel title="Organizational memory" sub="Every research run, connector check, deal opened and note — appended as it happens, newest first." />
    </UnavailablePage>
  );
}
