import { FormDetail } from "@/components/form-detail";
import { getFormByType } from "@/lib/forms";

export default function Aoc4DetailPage({ params }: { params: { id: string } }) {
  return <FormDetail form={getFormByType("AOC4")} id={params.id} />;
}
