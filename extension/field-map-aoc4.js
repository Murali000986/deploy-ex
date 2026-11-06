// AOC-4 (Online) eForm — field map
// Keep in sync with admin/lib/form-field-maps.ts
// Online AOC-4 uses the modern label-matching renderer similar to AOC-4 Offline.
// Selectors are label-based; the renderer looks up inputs near matching labels.

const AOC4_CATEGORIES = [
  {
    id: "general_info",
    label: "General Information",
    icon: "building",
    fields: [
      { key: "cin",                 label: "Corporate Identity Number (CIN)",       matchLabel: "Corporate Identity Number",  type: "text",   dataKey: "cin",                 required: true  },
      { key: "authorisedCapital",   label: "Authorised capital",                     matchLabel: "Authorised capital",         type: "text",   dataKey: "authorisedCapital",   required: false },
      { key: "numberOfMembers",     label: "Number of members",                      matchLabel: "Number of members",          type: "text",   dataKey: "numberOfMembers",     required: false },
      { key: "financialYearFrom",   label: "Financial year From",                    matchLabel: "Financial year",             type: "date",   dataKey: "financialYearFrom",   required: true,  rowIndex: 0 },
      { key: "financialYearTo",     label: "Financial year To",                      matchLabel: "Financial year",             type: "date",   dataKey: "financialYearTo",     required: true,  rowIndex: 1 },
      { key: "boardMeetingDateFS",  label: "Board Meeting Date (FS Approved)",       matchLabel: "Board meeting",              type: "date",   dataKey: "boardMeetingDateFS",  required: true  },
      { key: "natureOfFS",          label: "Nature of Financial Statements",         matchLabel: "Nature of financial",        type: "select", dataKey: "natureOfFS",          required: true  },
    ],
  },
  {
    id: "signatory",
    label: "Signatory Details",
    icon: "user",
    fields: [
      { key: "director1DIN",   label: "Director 1 — DIN / PAN",             matchLabel: "DIN",            type: "text",   dataKey: "director1DIN",         required: true  },
      { key: "director1Name",  label: "Director 1 — Name",                  matchLabel: "Name",           type: "text",   dataKey: "director1Name",        required: true  },
      { key: "director1Designation", label: "Director 1 — Designation",     matchLabel: "Designation",    type: "select", dataKey: "director1Designation", required: true  },
      { key: "director1DateFS",      label: "Director 1 — Signing Date (FS)", matchLabel: "Signing date", type: "date",   dataKey: "director1DateFS",      required: true  },
      { key: "boardMeetingDateBR",   label: "Board Meeting Date (Board's Report)", matchLabel: "Board's report", type: "date", dataKey: "boardMeetingDateBR", required: true },
      { key: "auditorSigningDate",   label: "Auditor Signing Date",          matchLabel: "Auditor signing", type: "date",  dataKey: "auditorSigningDate",   required: true  },
    ],
  },
  {
    id: "agm",
    label: "AGM Details",
    icon: "calendar",
    fields: [
      { key: "agmHeld",    label: "AGM Held",         matchLabel: "AGM held",      type: "select", dataKey: "agmHeld",    required: true  },
      { key: "agmDate",    label: "Date of AGM",      matchLabel: "Date of AGM",   type: "date",   dataKey: "agmDate",    required: false },
      { key: "agmDueDate", label: "Due Date of AGM",  matchLabel: "Due date",      type: "date",   dataKey: "agmDueDate", required: false },
    ],
  },
  {
    id: "auditor",
    label: "Auditor Details",
    icon: "shield",
    fields: [
      { key: "srnADT1",             label: "SRN of Form ADT-1",         matchLabel: "SRN",             type: "text",   dataKey: "srnADT1",             required: true  },
      { key: "numberOfAuditors",    label: "Number of Auditors",        matchLabel: "Number of auditors", type: "text", dataKey: "numberOfAuditors",    required: true  },
      { key: "auditorPAN",          label: "Auditor PAN",               matchLabel: "PAN",             type: "text",   dataKey: "auditorPAN",          required: true  },
      { key: "auditorCategory",     label: "Category of Auditor",       matchLabel: "Category",        type: "select", dataKey: "auditorCategory",     required: true  },
      { key: "auditorMembershipNo", label: "Membership / Registration No", matchLabel: "Membership",   type: "text",   dataKey: "auditorMembershipNo", required: true  },
      { key: "auditorName",         label: "Auditor / Firm Name",       matchLabel: "Firm name",       type: "text",   dataKey: "auditorName",         required: true  },
    ],
  },
];

// Flattened array for autoFillAoc4Fields consumption
const AOC4_FIELDS = AOC4_CATEGORIES.flatMap(c => c.fields);
