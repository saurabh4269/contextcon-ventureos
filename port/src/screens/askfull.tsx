"use client";
/** v3.3 · Full-page assistant (expanded from the dock or the Today Ask card). First run shows the chat-first empty state. */
import Link from "next/link";
import { Minimize2 } from "lucide-react";
import { Page, TopBar } from "../components/shell";
import { AssistantFull } from "../components/assistant";
import { ScreenSkeleton, ErrorState } from "../components/states";
import type { AssistantData, ScreenStatus, ShellData } from "../types";

export function AskFullScreen({ shell, data, back, onSuggestion, onSend, status = "ready", error, onRetry }: { shell: ShellData; data: AssistantData; back?: { label: string; href: string }; onSuggestion?: (a: string) => void; onSend?: (t: string) => void } & ScreenStatus) {
  // Breadcrumb like Today: page title, then the thread (its first question) or "New chat".
  const thread = data.messages.find((m) => m.from === "user")?.text;
  const lead = (
    <span className="flex min-w-0 items-baseline gap-2">
      <span className="text-[13px] font-medium text-ink">Assistant</span><span className="text-zinc-300">/</span>
      <span className="truncate">{thread ?? "New chat"}</span>
    </span>
  );
  const right = back && (
    <Link href={back.href} className="mr-1 inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[12.5px] text-zinc-500 ring-1 ring-zinc-200/80 transition-colors hover:bg-white hover:text-ink hover:shadow-[0_1px_2px_rgba(9,9,11,.06)]"><Minimize2 className="size-3.5" />{back.label}</Link>
  );
  const empty = status === "empty" ? { ...data, messages: [] } : data;
  return (
    <Page active="assistant" shell={shell} top={<TopBar crumbs={[{ label: "Assistant" }]} pill={false} lead={lead} right={right} />}>
      {status === "loading" ? <ScreenSkeleton cols="grid-cols-[1fr]" /> : status === "error" ? <ErrorState message={error} onRetry={onRetry} />
        : <AssistantFull data={empty} onSuggestion={onSuggestion} onSend={onSend} />}
    </Page>
  );
}
