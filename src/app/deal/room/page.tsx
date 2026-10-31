"use client";
// Data room: no data-room source in this build → unavailable state (for any deal).
import { use } from "react";
import { UnavailablePage } from "@/live/unavailable";

export default function Room({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const q = use(searchParams);
  const crumbs = q.id ? [{ label: q.id, href: `/deal?domain=${encodeURIComponent(q.id)}` }, { label: "Data room" }] : [{ label: "Data room" }];
  return <UnavailablePage screen="room" active="pipeline" crumbs={crumbs} />;
}
