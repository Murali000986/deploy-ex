import type { FormType, WorkflowStage } from "./types";
import { AOC4_STAGE_ORDER, STAGE_ORDER } from "./types";

export type FormDescriptor = {
  value: FormType;
  slug: string;
  label: string;
  shortLabel: string;
  description: string;
  longDescription: string;
  /** Lucide icon name used in sidebar / cards. The actual icon is imported in UI. */
  iconKey:
    | "FileCheck2"
    | "HardDrive"
    | "FileSignature"
    | "Building2"
    | "UserCheck";
  /** CSS tint used on the hub tile. */
  tint: string;
  /** The workflow stage order used by this form. */
  stageOrder: WorkflowStage[];
  /** Which page it links to. */
  listingHref: string;
  /** Extension form key — used by the Load-in-Extension bridge. */
  extensionKey: "spice_a" | "inc32" | "dir3" | "aoc4" | "aoc4_offline";
};

export const FORMS: FormDescriptor[] = [
  {
    value: "AOC4",
    slug: "aoc4",
    label: "AOC-4 (Online)",
    shortLabel: "AOC-4",
    description: "Annual financial statements — online eForm",
    longDescription:
      "Filing of annual financial statements by companies. Uses the modern MCA renderer with CSS-selector based field mapping.",
    iconKey: "FileCheck2",
    tint: "bg-emerald-50 text-emerald-700 border-emerald-100",
    stageOrder: AOC4_STAGE_ORDER,
    listingHref: "/forms/aoc4",
    extensionKey: "aoc4",
  },
  {
    value: "AOC4_OFFLINE",
    slug: "aoc4-offline",
    label: "AOC-4 Offline",
    shortLabel: "AOC-4 Offline",
    description: "Annual financial statements — offline eForm (label-matched)",
    longDescription:
      "Legacy offline AOC-4 workbook. Fields are matched by label text and grouped into 9 category sections.",
    iconKey: "HardDrive",
    tint: "bg-amber-50 text-amber-700 border-amber-100",
    stageOrder: AOC4_STAGE_ORDER,
    listingHref: "/forms/aoc4-offline",
    extensionKey: "aoc4_offline",
  },
  {
    value: "SPICE_PART_A",
    slug: "spice-part-a",
    label: "SPICe+ Part A",
    shortLabel: "SPICe+ Part A",
    description: "Name reservation for new incorporation",
    longDescription:
      "SPICe+ Part A — proposed-name reservation and company-type selection prior to incorporation.",
    iconKey: "FileSignature",
    tint: "bg-sky-50 text-sky-700 border-sky-100",
    stageOrder: STAGE_ORDER,
    listingHref: "/forms/spice-part-a",
    extensionKey: "spice_a",
  },
  {
    value: "INC32",
    slug: "inc32",
    label: "INC-32 (SPICe+ Part B)",
    shortLabel: "INC-32",
    description: "Incorporation application (SPICe+ Part B)",
    longDescription:
      "Integrated company incorporation application combining incorporation, DIN allotment, PAN & TAN.",
    iconKey: "Building2",
    tint: "bg-violet-50 text-violet-700 border-violet-100",
    stageOrder: AOC4_STAGE_ORDER,
    listingHref: "/forms/inc32",
    extensionKey: "inc32",
  },
  {
    value: "DIR3_KYC",
    slug: "dir3-kyc",
    label: "DIR-3 KYC",
    shortLabel: "DIR-3 KYC",
    description: "Annual KYC for directors",
    longDescription:
      "DIR-3 KYC — annual KYC filing for directors holding a Director Identification Number (DIN).",
    iconKey: "UserCheck",
    tint: "bg-rose-50 text-rose-700 border-rose-100",
    stageOrder: AOC4_STAGE_ORDER,
    listingHref: "/forms/dir3-kyc",
    extensionKey: "dir3",
  },
];

export function getForm(slugOrValue: string): FormDescriptor | undefined {
  return FORMS.find(
    f => f.slug === slugOrValue || f.value === slugOrValue
  );
}

export function getFormByType(value: FormType): FormDescriptor {
  const f = FORMS.find(f => f.value === value);
  if (!f) throw new Error(`Unknown form type: ${value}`);
  return f;
}
