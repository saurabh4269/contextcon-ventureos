"use client";
// Assistant: no AI model is wired into the assistant in this build → unavailable state with the AI model's real status.
import { UnavailablePage } from "@/live/unavailable";

export default function Ask() {
  return <UnavailablePage screen="ask" active="assistant" />;
}
