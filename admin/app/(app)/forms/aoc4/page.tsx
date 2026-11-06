import { FormPage } from "@/components/form-page";
import { getFormByType } from "@/lib/forms";

export default function Aoc4QueuePage() {
  return <FormPage form={getFormByType("AOC4")} />;
}
