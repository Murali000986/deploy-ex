import { FormPage } from "@/components/form-page";
import { getFormByType } from "@/lib/forms";

export default function Dir3KycQueuePage() {
  return <FormPage form={getFormByType("DIR3_KYC")} />;
}
