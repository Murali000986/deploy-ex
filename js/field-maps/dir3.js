// DIR-3 KYC — Director KYC field map stub.
// Selectors are placeholders until a live MCA DIR-3 scan lands; OTP-gated
// fields are flagged with manualAfterFill so the timeline shows a "manual
// step required" sub-detail rather than reporting them as missed.

(function (root) {
  "use strict";

  const DIR3_CATEGORIES = [
    {
      id: "identity",
      label: "Identity",
      icon: "user",
      fields: [
        { key: "din",   label: "DIN",                 dataKey: "din",   type: "text",   required: true,  selector: "input[name='din'], input[aria-label*='DIN']"            },
        { key: "pan",   label: "Income-tax PAN",      dataKey: "pan",   type: "text",   required: true,  selector: "input[name='pan'], input[aria-label*='PAN']"            },
        { key: "name",  label: "Full name",           dataKey: "name",  type: "text",   required: true,  selector: "input[name='name'], input[aria-label*='Name']"          },
        { key: "fatherName", label: "Father's name",  dataKey: "fatherName", type: "text", required: false, selector: "input[name='fatherName'], input[aria-label*=\"Father\"]" },
        { key: "dob",   label: "Date of birth",       dataKey: "dob",   type: "date",   required: true,  selector: "input[name='dob'], input[aria-label*='Date of birth']"  },
        { key: "gender",label: "Gender",              dataKey: "gender",type: "select", required: true,  selector: "select[name='gender'], select[aria-label*='Gender']"    },
        { key: "nationality", label: "Nationality",   dataKey: "nationality", type: "select", required: true, selector: "select[name='nationality'], select[aria-label*='Nationality']" },
      ],
    },
    {
      id: "contact",
      label: "Contact (OTP)",
      icon: "shield",
      fields: [
        { key: "mobile", label: "Mobile number",      dataKey: "mobile", type: "text", required: true, selector: "input[name='mobile'], input[aria-label*='Mobile']",
          manualAfterFill: true, otpStep: true },
        { key: "email",  label: "Email ID",           dataKey: "email",  type: "text", required: true, selector: "input[name='email'], input[type='email']",
          manualAfterFill: true, otpStep: true },
      ],
    },
    {
      id: "address",
      label: "Address",
      icon: "map",
      fields: [
        { key: "addr1",   label: "Address line 1",  dataKey: "addr1",   type: "text",   required: true,  selector: "input[name='addr1'], input[aria-label*='Address line 1']" },
        { key: "addr2",   label: "Address line 2",  dataKey: "addr2",   type: "text",   required: false, selector: "input[name='addr2'], input[aria-label*='Address line 2']" },
        { key: "city",    label: "City",            dataKey: "city",    type: "text",   required: true,  selector: "input[name='city'], input[aria-label*='City']"            },
        { key: "state",   label: "State",           dataKey: "state",   type: "select", required: true,  selector: "select[name='state'], select[aria-label*='State']"         },
        { key: "country", label: "Country",         dataKey: "country", type: "select", required: true,  selector: "select[name='country'], select[aria-label*='Country']"     },
        { key: "pincode", label: "Pin code",        dataKey: "pincode", type: "text",   required: true,  selector: "input[name='pincode'], input[aria-label*='Pin']"           },
      ],
    },
  ];

  const DIR3_FIELDS = DIR3_CATEGORIES.flatMap(function (c) {
    return c.fields.map(function (f) {
      return Object.assign({ category: c.id, categoryLabel: c.label }, f);
    });
  });

  root.DIR3_CATEGORIES = DIR3_CATEGORIES;
  root.DIR3_FIELDS = DIR3_FIELDS;
  root.DIR3_EXPECTED_FIELDS = DIR3_FIELDS.length;
})(typeof window !== "undefined" ? window : globalThis);
