import { FormDetail } from "@/components/form-detail";
import { getFormByType } from "@/lib/forms";

export default function Dir3KycDetailPage({ params }: { params: { id: string } }) {
  return <FormDetail form={getFormByType("DIR3_KYC")} id={params.id} />;
}
