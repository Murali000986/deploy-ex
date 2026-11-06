import { FormPage } from "@/components/form-page";
import { getFormByType } from "@/lib/forms";

export default function SpicePartAQueuePage() {
  return (
    <FormPage
      form={getFormByType("SPICE_PART_A")}
      secondaryNote="Wrapper view. The full SPICe+ workflow lives at /spice."
    />
  );
}
