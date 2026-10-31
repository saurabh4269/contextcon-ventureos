import type { ShellData } from "../../src/types";
import { askByPage } from "./assistant";

export const shellInvest: ShellData = {
  user: { id: "u_sg", name: "Saurabh Gupta", firstName: "Saurabh", initials: "SG" },
  firm: { name: "Northbeam Ventures", sub: "Fund III · Seed to Series A", initial: "N" },
  badges: { today: { count: 2, alert: true }, pipeline: { count: 25 }, portfolio: { count: 3, alert: true } },
  agentsWorking: 1,
  unreadNotifications: true,
  assistantByPage: askByPage,
};
export const shellBank: ShellData = {
  ...shellInvest,
  badges: { today: { count: 2, alert: true }, pipeline: { count: 11 }, mandates: { count: 3 } },
};
/** First run: nothing to badge yet. */
export const shellFirstRun: ShellData = { ...shellInvest, badges: {}, agentsWorking: 1, unreadNotifications: false };
