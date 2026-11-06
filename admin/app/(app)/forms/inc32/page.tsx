import { FormPage } from "@/components/form-page";
import { getFormByType } from "@/lib/forms";

export default function Inc32QueuePage() {
  return <FormPage form={getFormByType("INC32")} />;
}
