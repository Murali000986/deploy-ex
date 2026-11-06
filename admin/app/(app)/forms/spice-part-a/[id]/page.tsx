import { FormDetail } from "@/components/form-detail";
import { getFormByType } from "@/lib/forms";

export default function SpicePartADetailPage({ params }: { params: { id: string } }) {
  return <FormDetail form={getFormByType("SPICE_PART_A")} id={params.id} />;
}
