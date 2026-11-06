// AOC-4 (Online) eForm — label-match field map used by the simplified multi-form
// filler. The full AOC-4 flow stays on js/field-mapper.js + js/phase-runner.js;
// this map is only consumed when the user picks the "AOC-4" pill but wants to use
// the quick-fill textarea entry path (parity with the other 4 forms).

(function (root) {
  "use strict";
  if (root.AOC4_CATEGORIES && root.AOC4_FIELDS) return;

  const AOC4_CATEGORIES = [
    {
      id: "general_info",
      label: "General Information",
      icon: "building",
      fields: [
        { key: "cin",                 label: "Corporate Identity Number (CIN)",     matchLabel: "Corporate Identity Number", type: "text",   dataKey: "cin",                 required: true  },
        { key: "authorisedCapital",   label: "Authorised capital",                   matchLabel: "Authorised capital",        type: "text",   dataKey: "authorisedCapital",   required: false },
        { key: "numberOfMembers",     label: "Number of members",                    matchLabel: "Number of members",         type: "text",   dataKey: "numberOfMembers",     required: false },
        { key: "financialYearFrom",   label: "Financial year From",                  matchLabel: "Financial year",            type: "date",   dataKey: "financialYearFrom",   required: true,  rowIndex: 0 },
        { key: "financialYearTo",     label: "Financial year To",                    matchLabel: "Financial year",            type: "date",   dataKey: "financialYearTo",     required: true,  rowIndex: 1 },
        { key: "boardMeetingDateFS",  label: "Board Meeting Date (FS Approved)",     matchLabel: "Board meeting",             type: "date",   dataKey: "boardMeetingDateFS",  required: true  },
        { key: "natureOfFS",          label: "Nature of Financial Statements",       matchLabel: "Nature of financial",       type: "select", dataKey: "natureOfFS",          required: true  },
      ],
    },
    {
      id: "signatory",
      label: "Signatory Details",
      icon: "user",
      fields: [
        { key: "director1DIN",         label: "Director 1 — DIN / PAN",               matchLabel: "DIN",            type: "text",   dataKey: "director1DIN",         required: true },
        { key: "director1Name",        label: "Director 1 — Name",                    matchLabel: "Name",           type: "text",   dataKey: "director1Name",        required: true },
        { key: "director1Designation", label: "Director 1 — Designation",             matchLabel: "Designation",    type: "select", dataKey: "director1Designation", required: true },
        { key: "director1DateFS",      label: "Director 1 — Signing Date (FS)",       matchLabel: "Signing date",   type: "date",   dataKey: "director1DateFS",      required: true },
        { key: "boardMeetingDateBR",   label: "Board Meeting Date (Board's Report)",  matchLabel: "Board's report", type: "date",   dataKey: "boardMeetingDateBR",   required: true },
        { key: "auditorSigningDate",   label: "Auditor Signing Date",                 matchLabel: "Auditor signing",type: "date",   dataKey: "auditorSigningDate",   required: true },
      ],
    },
    {
      id: "agm",
      label: "AGM Details",
      icon: "calendar",
      fields: [
        { key: "agmHeld",    label: "AGM Held",         matchLabel: "AGM held",     type: "select", dataKey: "agmHeld",    required: true  },
        { key: "agmDate",    label: "Date of AGM",      matchLabel: "Date of AGM",  type: "date",   dataKey: "agmDate",    required: false },
        { key: "agmDueDate", label: "Due Date of AGM",  matchLabel: "Due date",     type: "date",   dataKey: "agmDueDate", required: false },
      ],
    },
    {
      id: "auditor",
      label: "Auditor Details",
      icon: "shield",
      fields: [
        { key: "srnADT1",             label: "SRN of Form ADT-1",             matchLabel: "SRN",                 type: "text",   dataKey: "srnADT1",             required: true },
        { key: "numberOfAuditors",    label: "Number of Auditors",            matchLabel: "Number of auditors",  type: "text",   dataKey: "numberOfAuditors",    required: true },
        { key: "auditorPAN",          label: "Auditor PAN",                   matchLabel: "PAN",                 type: "text",   dataKey: "auditorPAN",          required: true },
        { key: "auditorCategory",     label: "Category of Auditor",           matchLabel: "Category",            type: "select", dataKey: "auditorCategory",     required: true },
        { key: "auditorMembershipNo", label: "Membership / Registration No",  matchLabel: "Membership",          type: "text",   dataKey: "auditorMembershipNo", required: true },
        { key: "auditorName",         label: "Auditor / Firm Name",           matchLabel: "Firm name",           type: "text",   dataKey: "auditorName",         required: true },
      ],
    },
  ];

  const AOC4_FIELDS = AOC4_CATEGORIES.flatMap(function (c) {
    return c.fields.map(function (f) {
      return Object.assign({ _category: c.id, _categoryLabel: c.label }, f);
    });
  });

  root.AOC4_CATEGORIES = AOC4_CATEGORIES;
  root.AOC4_FIELDS = AOC4_FIELDS;
  root.AOC4_EXPECTED_FIELDS = AOC4_FIELDS.length;
})(typeof window !== "undefined" ? window : globalThis);
