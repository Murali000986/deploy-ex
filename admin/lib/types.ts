export type Role = "ADMIN" | "SUPERADMIN";

export type FormType = "SPICE_PART_A" | "INC32" | "DIR3_KYC" | "AOC4" | "AOC4_OFFLINE";

export type WorkflowStage =
  | "DRAFT"
  | "AWAITING_CLIENT"
  | "COLLECTING_DETAILS"
  | "AI_VALIDATION"
  | "NEEDS_CORRECTION"
  | "NAME_SCREENING"
  | "NAME_CONFLICT"
  | "AWAITING_ALTERNATIVE_NAME"
  | "ADMIN_REVIEW"
  | "READY_FOR_PART_A"
  | "HUMAN_HANDOFF"
  | "FAILED_RETRY"
  | "REJECTED"
  | "CANCELLED"
  // Generic form-filing stages (AOC-4 and other forms)
  | "FORM_DRAFT"
  | "FORM_PREFILL"
  | "FORM_VALIDATION"
  | "FORM_READY_TO_FILE"
  | "FORM_FILED"
  | "FORM_CORRECTION";

export const STAGE_ORDER: WorkflowStage[] = [
  "DRAFT",
  "COLLECTING_DETAILS",
  "AI_VALIDATION",
  "NEEDS_CORRECTION",
  "NAME_SCREENING",
  "ADMIN_REVIEW",
  "READY_FOR_PART_A",
];

// Progression for AOC-4 / generic form-filing workflow.
export const AOC4_STAGE_ORDER: WorkflowStage[] = [
  "FORM_DRAFT",
  "FORM_PREFILL",
  "FORM_VALIDATION",
  "FORM_READY_TO_FILE",
  "FORM_FILED",
];

export const STAGE_LABEL: Record<WorkflowStage, string> = {
  DRAFT: "Draft",
  AWAITING_CLIENT: "Awaiting Client",
  COLLECTING_DETAILS: "Collecting Details",
  AI_VALIDATION: "AI Validation",
  NEEDS_CORRECTION: "Needs Correction",
  NAME_SCREENING: "Name Screening",
  NAME_CONFLICT: "Name Conflict",
  AWAITING_ALTERNATIVE_NAME: "Awaiting Alternative Name",
  ADMIN_REVIEW: "Admin Review",
  READY_FOR_PART_A: "Ready for Part A",
  HUMAN_HANDOFF: "Human Handoff",
  FAILED_RETRY: "Failed / Retry Pending",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  FORM_DRAFT: "Draft",
  FORM_PREFILL: "Prefill",
  FORM_VALIDATION: "Validation",
  FORM_READY_TO_FILE: "Ready to File",
  FORM_FILED: "Filed",
  FORM_CORRECTION: "Needs Correction",
};

export type ScreeningVerdict =
  | "EXACT_MATCH"
  | "SIMILAR_FOUND"
  | "TRADEMARK_CONCERN"
  | "NO_MATCH"
  | "SEARCH_INCOMPLETE"
  | "HUMAN_REVIEW_REQUIRED";

export const SCREENING_LABEL: Record<ScreeningVerdict, string> = {
  EXACT_MATCH: "Exact match",
  SIMILAR_FOUND: "Similar name found",
  TRADEMARK_CONCERN: "Trademark concern",
  NO_MATCH: "No match found",
  SEARCH_INCOMPLETE: "Search incomplete",
  HUMAN_REVIEW_REQUIRED: "Human review required",
};

export type StageEvent = { stage: WorkflowStage; enteredAt: string; actor?: string; note?: string };

export type ProposedName = {
  name: string;
  verdict: ScreeningVerdict;
  checkedAt?: string;
  source?: string;
  notes?: string;
};

export type ValidationIssue = { field: string; severity: "ERROR" | "WARN"; message: string };

export type WhatsAppMessage = {
  id: string;
  direction: "IN" | "OUT";
  author: string;
  text: string;
  at: string;
  deliveryState?: "SENT" | "DELIVERED" | "READ" | "FAILED" | "PENDING";
  by?: "AI" | "HUMAN";
};

export type AuditEvent = { id: string; at: string; actor: string; action: string; detail?: string };

export type ClientRequest = {
  id: string;
  clientName: string;
  clientPhone: string;
  clientEmail?: string;
  companyType: "PRIVATE_LIMITED" | "OPC" | "LLP" | "PUBLIC_LIMITED";
  proposedNames: ProposedName[];
  currentStage: WorkflowStage;
  stageHistory: StageEvent[];
  assignedAdmin?: string;
  blockingIssues: string[];
  nextAction: string;
  lastActivityAt: string;
  createdAt: string;
  validation: ValidationIssue[];
  submittedFields: Record<string, string>;
  conversation: WhatsAppMessage[];
  audit: AuditEvent[];
  handledBy: "AI" | "HUMAN";
  /**
   * Which form workflow this request belongs to. Defaults to SPICE_PART_A for
   * legacy SPICe+ requests so existing routes keep working unchanged.
   */
  formType?: FormType;
  /** Company CIN (used by AOC-4 and other post-incorporation forms). */
  cin?: string;
  /** Financial year string, e.g. "2024-25" (AOC-4 and friends). */
  financialYear?: string;
};

export type UserAccount = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string;
};
