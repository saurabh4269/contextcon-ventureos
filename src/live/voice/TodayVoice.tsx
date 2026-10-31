"use client";
// /today: the assistant dock opens with the voice greeting and tries to speak right away (autoplay may need a tap).
import { useVoiceAgent } from "./useVoiceAgent";
import { VoicePanel } from "./VoicePanel";

export function TodayVoiceDock() {
  const agent = useVoiceAgent({ context: () => ({ screen: "today" }), autoStart: true });
  return <VoicePanel agent={agent} variant="dock" title="Good to see you" />;
}
