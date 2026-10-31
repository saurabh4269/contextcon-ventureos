// Google Calendar API v3 on the primary calendar.
//   events.list    GET  /calendar/v3/calendars/primary/events?timeMin=<now>&singleEvents=true&orderBy=startTime&maxResults=N
//   events.insert  POST /calendar/v3/calendars/primary/events?sendUpdates=none   (book-call flow)
//   events.delete  DELETE /calendar/v3/calendars/primary/events/{id}?sendUpdates=none
//   calendarList.get primary (health check)
import { googleJson, type GoogleConfig } from "./oauth";

const API = "https://www.googleapis.com/calendar/v3";

export type Meeting = { id: string; summary: string; start: string; end: string | null; allDay: boolean; attendees: number; link: string | null };
type GEvent = { id: string; summary?: string; start?: { dateTime?: string; date?: string }; end?: { dateTime?: string; date?: string }; attendees?: unknown[]; hangoutLink?: string; htmlLink?: string };

export const toMeeting = (e: GEvent): Meeting => ({
  id: e.id,
  summary: e.summary ?? "(no title)",
  start: e.start?.dateTime ? new Date(e.start.dateTime).toISOString() : (e.start?.date ?? ""),
  end: e.end?.dateTime ? new Date(e.end.dateTime).toISOString() : (e.end?.date ?? null),
  allDay: !e.start?.dateTime,
  attendees: e.attendees?.length ?? 0,
  link: e.hangoutLink ?? null,
});

export async function listUpcoming(cfg: GoogleConfig, opts: { from: Date; max: number }, f: typeof fetch = fetch): Promise<Meeting[]> {
  const qs = new URLSearchParams({ timeMin: opts.from.toISOString(), singleEvents: "true", orderBy: "startTime", maxResults: String(opts.max) });
  const { data } = await googleJson<{ items?: GEvent[] }>(cfg, `${API}/calendars/primary/events?${qs}`, {}, f);
  return (data.items ?? []).map(toMeeting);
}

export type NewEvent = { summary: string; start: string; end: string; description?: string; attendees?: string[] };
export async function insertEvent(cfg: GoogleConfig, e: NewEvent, f: typeof fetch = fetch): Promise<Meeting> {
  const body = { summary: e.summary, description: e.description, start: { dateTime: e.start }, end: { dateTime: e.end }, ...(e.attendees?.length ? { attendees: e.attendees.map((email) => ({ email })) } : {}) };
  const { data } = await googleJson<GEvent>(cfg, `${API}/calendars/primary/events?sendUpdates=none`, { method: "POST", body: JSON.stringify(body) }, f);
  return toMeeting(data);
}

/** 204 when deleted; 410 when it was already gone; 404 when the id never existed (all mean "not on the calendar"). */
export async function deleteEvent(cfg: GoogleConfig, id: string, f: typeof fetch = fetch): Promise<number> {
  try {
    return (await googleJson<null>(cfg, `${API}/calendars/primary/events/${encodeURIComponent(id)}?sendUpdates=none`, { method: "DELETE" }, f)).status;
  } catch (e) {
    const st = (e as { httpStatus?: number }).httpStatus;
    if (st === 410 || st === 404) return st;
    throw e;
  }
}

export async function primaryCalendar(cfg: GoogleConfig, f: typeof fetch = fetch) {
  return (await googleJson<{ id: string; timeZone?: string }>(cfg, `${API}/users/me/calendarList/primary`, {}, f)).data;
}
