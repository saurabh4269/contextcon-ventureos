import { redirect } from "next/navigation";

/** The restored Settings hub owns workflow; this path is what the UI copy still links as /workflow. */
export default function Workflow() {
  redirect("/settings?section=workflow");
}
