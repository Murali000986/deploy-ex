import { FormPage } from "@/components/form-page";
import { getFormByType } from "@/lib/forms";

export default function Aoc4OfflineQueuePage() {
  return (
    <FormPage
      form={getFormByType("AOC4_OFFLINE")}
      secondaryNote="Offline eForm — fields matched by label text."
    />
  );
}
