import { StagePage } from "@/components/stage-page";
export default function Page() {
  return <StagePage title="Human Handoff / Failed Jobs" description="Requests escalated to a human operator or blocked by integration failures." stage="HUMAN_HANDOFF" extra={["FAILED_RETRY"]} />;
}
