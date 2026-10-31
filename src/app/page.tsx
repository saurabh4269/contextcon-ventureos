import Link from "next/link";
export default function Home() {
  return <div className="p-10 space-y-2">{["landing","today","pipeline","deal","portfolio","mandates","memo","brain","agents","ask","settings","slack"].map(s=><div key={s}><Link className="underline" href={`/${s}`}>{s}</Link></div>)}</div>;
}
