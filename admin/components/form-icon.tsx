import {
  FileCheck2,
  HardDrive,
  FileSignature,
  Building2,
  UserCheck,
} from "lucide-react";
import type { FormDescriptor } from "@/lib/forms";

const MAP: Record<FormDescriptor["iconKey"], React.ElementType> = {
  FileCheck2,
  HardDrive,
  FileSignature,
  Building2,
  UserCheck,
};

/** Renders the lucide icon that matches `form.iconKey`. */
export function FormIcon({
  form,
  className = "h-5 w-5",
}: {
  form: FormDescriptor;
  className?: string;
}) {
  const Icon = MAP[form.iconKey] ?? FileCheck2;
  return <Icon className={className} />;
}
