import { StagePage } from "@/components/stage-page";
export default function Page() {
  return <StagePage title="Name Screening" description="Requests currently running or awaiting name availability checks." stage="NAME_SCREENING" extra={["NAME_CONFLICT", "AWAITING_ALTERNATIVE_NAME"]} />;
}
