"use client";
// Design reference only — not an app route. Shows every Slack/Teams card Deal Desk posts, built server-side as Block Kit.
import { SlackCard, SlackFrame, SlackWindow } from "../components/slack";
import type { SlackMessage } from "../types";
import { cx } from "../components/ui";

export interface SlackPreviewScreenProps {
  channels: { channel: string; note: string; messages: SlackMessage[] }[];
  onAction?: (messageId: string, buttonId: string) => void;
}

export function SlackPreviewScreen({ channels, onAction }: SlackPreviewScreenProps) {
  return (
    <div className="min-h-screen bg-[#f8f8f8] px-12 py-10">
      <div className="mx-auto max-w-[1240px]">
        <div className="eyebrow">Design reference · Slack / Teams cards</div>
        <h1 className="serif mt-1 text-[34px] leading-none">What Deal Desk posts, and who sees it</h1>
        <div className="mt-6 grid grid-cols-2 gap-6">
          {channels.map((c) => (
            <div key={c.channel + c.note}>
              <div className="mb-2 text-[12px] text-zinc-500">{c.note}</div>
              <SlackFrame channel={c.channel}>{c.messages.map((m) => <SlackCard key={m.id} m={m} onAction={onAction} />)}</SlackFrame>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** v3 · One Slack state, full window. Frames come from fixtures (e.g. slackIcVoteFrame(n)) so each is a still for video. */
export interface SlackStateScreenProps {
  channel: string;
  caption: string;
  context?: { who: string; time: string; text: string }[];
  messages: SlackMessage[];
  frame?: { n: number; of: number };
  onAction?: (messageId: string, buttonId: string) => void;
}
export function SlackStateScreen({ channel, caption, context, messages, frame, onAction }: SlackStateScreenProps) {
  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#f3f2ef,#ebeae6)] px-12 py-10">
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-4 flex items-end justify-between">
          <div><div className="eyebrow eyebrow-mark">Slack · {channel}</div><h1 className="serif mt-1 text-[30px] leading-none">{caption}</h1></div>
          {frame && <div className="flex items-center gap-1.5">{Array.from({ length: frame.of }, (_, i) => <span key={i} className={cx("h-1.5 rounded-full", i + 1 === frame.n ? "w-6 bg-ink" : i + 1 < frame.n ? "w-1.5 bg-ink/60" : "w-1.5 bg-ink/15")} />)}<span className="tnum ml-2 text-[11.5px] text-zinc-500">frame {frame.n}/{frame.of}</span></div>}
        </div>
        <SlackWindow channel={channel} context={context}>{messages.map((m) => <SlackCard key={m.id} m={m} onAction={onAction} />)}</SlackWindow>
      </div>
    </div>
  );
}
