import { FormDetail } from "@/components/form-detail";
import { getFormByType } from "@/lib/forms";

export default function Inc32DetailPage({ params }: { params: { id: string } }) {
  return <FormDetail form={getFormByType("INC32")} id={params.id} />;
}
