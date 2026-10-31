"use client";
/** v3.2 · Assistant dock state shared by Page, Sidebar, TopBar and the dock itself (⌘J toggles it anywhere). */
import { createContext, useContext, useState, type ReactNode } from "react";

export interface AskCtx { open: boolean; setOpen: (open: boolean) => void; toggle: () => void; dock?: ReactNode }
export const AskContext = createContext<AskCtx | null>(null);
export const useAsk = () => useContext(AskContext);

/** Wrap any screen to open the dock with specific content (e.g. a frame of a conversation). Screens need no changes. */
export function AssistantHost({ children, dock, defaultOpen = true }: { children: ReactNode; dock?: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return <AskContext.Provider value={{ open, setOpen, toggle: () => setOpen(!open), dock }}>{children}</AskContext.Provider>;
}
