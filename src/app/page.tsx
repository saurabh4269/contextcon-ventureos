import Link from "next/link";
export default function Home() {
  return <div className="p-10 space-y-2">{["today","pipeline","portfolio","mandates","deal","deal/room","memo","brain","settings","preview/slack"].map(s=><div key={s}><Link className="underline" href={`/${s}`}>{s}</Link></div>)}</div>;
}
