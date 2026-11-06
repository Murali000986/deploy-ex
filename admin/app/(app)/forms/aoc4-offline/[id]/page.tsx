import { FormDetail } from "@/components/form-detail";
import { getFormByType } from "@/lib/forms";

export default function Aoc4OfflineDetailPage({ params }: { params: { id: string } }) {
  return <FormDetail form={getFormByType("AOC4_OFFLINE")} id={params.id} />;
}
