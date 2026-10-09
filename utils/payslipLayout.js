const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export const PAYSLIP_TEMPLATE_IDS = ["classic", "modern", "compact"];

const basePage = {
  size: "A4",
  orientation: "portrait",
  margin: { top: 40, right: 40, bottom: 40, left: 40 },
  unit: "pt",
};

const classicLayout = {
  templateId: "classic",
  name: "Classic",
  description: "Traditional two-column earnings/deductions table with net box",
  page: basePage,
  theme: {
    primaryColor: "#1F2937",
    accentColor: "#111827",
    mutedColor: "#6B7280",
    borderColor: "#E5E7EB",
    backgroundColor: "#FFFFFF",
    headerBackground: "#F9FAFB",
    fontFamily: "Helvetica",
    titleSize: 18,
    bodySize: 10,
    labelSize: 9,
  },
  sections: [
    {
      id: "header",
      type: "header",
      showLogo: true,
      showOrgName: true,
      showBrandName: true,
      title: "Salary Slip",
      alignment: "left",
    },
    {
      id: "employeeMeta",
      type: "keyValueGrid",
      columns: 2,
      fields: [
        { key: "employee.name", label: "Employee Name" },
        { key: "employee.employeeId", label: "Employee ID" },
        { key: "employee.role", label: "Designation" },
        { key: "period.label", label: "Pay Period" },
      ],
    },
    {
      id: "earningsDeductions",
      type: "twoColumnTables",
      left: {
        title: "Earnings",
        dataKey: "earnings",
        columns: [
          { key: "label", label: "Component" },
          { key: "amount", label: "Amount", align: "right", format: "currency" },
        ],
      },
      right: {
        title: "Deductions",
        dataKey: "deductions",
        columns: [
          { key: "label", label: "Component" },
          { key: "amount", label: "Amount", align: "right", format: "currency" },
        ],
      },
    },
    {
      id: "summary",
      type: "summaryBox",
      fields: [
        { key: "totals.gross", label: "Gross Earnings", format: "currency" },
        {
          key: "totals.structureDeductions",
          label: "Other Deductions",
          format: "currency",
        },
        { key: "lop.amount", label: "LOP Deduction", format: "currency" },
        {
          key: "totals.netPay",
          label: "Net Pay",
          format: "currency",
          emphasize: true,
        },
      ],
    },
    {
      id: "attendance",
      type: "keyValueGrid",
      columns: 3,
      title: "Attendance Summary",
      fields: [
        { key: "attendance.presentDays", label: "Present" },
        { key: "attendance.paidLeaveDays", label: "Paid Leave" },
        { key: "attendance.finalLopDays", label: "LOP Days" },
      ],
    },
    {
      id: "bank",
      type: "keyValueGrid",
      columns: 2,
      title: "Bank Details",
      fields: [
        { key: "bank.accountMasked", label: "Account" },
        { key: "bank.ifsc", label: "IFSC" },
      ],
    },
    {
      id: "footer",
      type: "footer",
      text: "This is a system generated salary slip.",
    },
  ],
};

const modernLayout = {
  templateId: "modern",
  name: "Modern",
  description: "Branded header with large net pay hero, then line items",
  page: { ...basePage, margin: { top: 32, right: 32, bottom: 32, left: 32 } },
  theme: {
    primaryColor: "#0F766E",
    accentColor: "#134E4A",
    mutedColor: "#64748B",
    borderColor: "#CCFBF1",
    backgroundColor: "#FFFFFF",
    headerBackground: "#0F766E",
    headerTextColor: "#FFFFFF",
    fontFamily: "Helvetica",
    titleSize: 20,
    bodySize: 10,
    labelSize: 9,
    heroNetSize: 28,
  },
  sections: [
    {
      id: "header",
      type: "header",
      showLogo: true,
      showOrgName: true,
      showBrandName: true,
      title: "Salary Slip",
      style: "banner",
      alignment: "left",
    },
    {
      id: "netHero",
      type: "heroAmount",
      label: "Net Pay",
      valueKey: "totals.netPay",
      format: "currency",
      subtitleKey: "period.label",
    },
    {
      id: "employeeMeta",
      type: "keyValueGrid",
      columns: 2,
      fields: [
        { key: "employee.name", label: "Employee" },
        { key: "employee.employeeId", label: "ID" },
        { key: "employee.role", label: "Role" },
        { key: "currency", label: "Currency" },
      ],
    },
    {
      id: "lines",
      type: "stackedTables",
      tables: [
        {
          title: "Earnings",
          dataKey: "earnings",
          columns: [
            { key: "label", label: "Component" },
            { key: "amount", label: "Amount", align: "right", format: "currency" },
          ],
        },
        {
          title: "Deductions",
          dataKey: "deductions",
          columns: [
            { key: "label", label: "Component" },
            { key: "amount", label: "Amount", align: "right", format: "currency" },
          ],
        },
      ],
    },
    {
      id: "lop",
      type: "keyValueGrid",
      columns: 2,
      title: "Loss of Pay",
      fields: [
        { key: "lop.days", label: "LOP Days" },
        { key: "lop.amount", label: "LOP Amount", format: "currency" },
      ],
    },
    {
      id: "bank",
      type: "keyValueGrid",
      columns: 2,
      fields: [
        { key: "bank.accountMasked", label: "Account" },
        { key: "bank.ifsc", label: "IFSC" },
      ],
    },
    {
      id: "footer",
      type: "footer",
      text: "System generated · For salary reference only",
    },
  ],
};

const compactLayout = {
  templateId: "compact",
  name: "Compact",
  description: "Dense print-friendly single page layout",
  page: { ...basePage, margin: { top: 28, right: 28, bottom: 28, left: 28 } },
  theme: {
    primaryColor: "#111827",
    accentColor: "#374151",
    mutedColor: "#9CA3AF",
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    headerBackground: "#FFFFFF",
    fontFamily: "Helvetica",
    titleSize: 14,
    bodySize: 9,
    labelSize: 8,
  },
  sections: [
    {
      id: "header",
      type: "header",
      showLogo: true,
      showOrgName: true,
      showBrandName: false,
      title: "Payslip",
      alignment: "left",
      compact: true,
    },
    {
      id: "employeeMeta",
      type: "inlineMeta",
      fields: [
        { key: "employee.name", label: "Name" },
        { key: "employee.employeeId", label: "ID" },
        { key: "period.label", label: "Period" },
        { key: "employee.role", label: "Role" },
      ],
    },
    {
      id: "combinedTable",
      type: "singleTable",
      title: "Components",
      dataKey: "components",
      columns: [
        { key: "type", label: "Type", width: 0.2 },
        { key: "label", label: "Particulars", width: 0.5 },
        { key: "amount", label: "Amount", align: "right", format: "currency", width: 0.3 },
      ],
    },
    {
      id: "summary",
      type: "summaryRow",
      fields: [
        { key: "totals.gross", label: "Gross", format: "currency" },
        { key: "lop.amount", label: "LOP", format: "currency" },
        { key: "totals.netPay", label: "Net", format: "currency", emphasize: true },
      ],
    },
    {
      id: "footer",
      type: "footer",
      text: "Computer generated payslip",
      compact: true,
    },
  ],
};

const LAYOUTS = {
  classic: classicLayout,
  modern: modernLayout,
  compact: compactLayout,
};

export const getPayslipLayout = (templateId = "classic") => {
  const id = PAYSLIP_TEMPLATE_IDS.includes(templateId) ? templateId : "classic";
  return LAYOUTS[id];
};

export const listPayslipTemplates = () =>
  PAYSLIP_TEMPLATE_IDS.map((id) => ({
    templateId: id,
    name: LAYOUTS[id].name,
    description: LAYOUTS[id].description,
  }));

const maskAccount = (accountNumber = "") => {
  const digits = String(accountNumber);
  if (!digits) return "";
  if (digits.length <= 4) return `XXXX${digits}`;
  return `XXXX${digits.slice(-4)}`;
};

const roleLabel = (role) => {
  if (role === "mr") return "Medical Representative";
  if (role === "areaManager") return "Area Manager";
  if (role === "zonalManager") return "Zonal Manager";
  return role || "";
};

/**
 * Build mobile/pdf-lib payload: layout + data + org branding.
 */
export const buildEmployeePayslipPayload = ({
  payslip,
  employee,
  organization,
  templateId = "classic",
}) => {
  const layout = getPayslipLayout(templateId);
  const month = payslip.month;
  const year = payslip.year;
  const periodLabel = `${MONTH_NAMES[month - 1] || month} ${year}`;

  const earnings = (payslip.earnings || []).map((e) => ({
    code: e.code || "",
    label: e.label,
    amount: e.amount,
  }));
  const deductions = (payslip.deductions || []).map((d) => ({
    code: d.code || "",
    label: d.label,
    amount: d.amount,
  }));

  if (payslip.lopAmount > 0) {
    deductions.push({
      code: "LOP",
      label: `Loss of Pay (${payslip.finalLopDays || 0} day(s))`,
      amount: payslip.lopAmount,
    });
  }

  const components = [
    ...earnings.map((e) => ({ type: "Earning", label: e.label, amount: e.amount })),
    ...deductions.map((d) => ({
      type: "Deduction",
      label: d.label,
      amount: d.amount,
    })),
  ];

  const name =
    employee?.displayName ||
    `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim();

  const data = {
    payslipId: String(payslip._id),
    currency: payslip.currency || "INR",
    period: {
      month,
      year,
      label: periodLabel,
    },
    employee: {
      id: String(employee?._id || payslip.employeeId),
      name,
      employeeId: employee?.employeeId || "",
      role: employee?.role || "",
      roleLabel: roleLabel(employee?.role),
      email: employee?.email || "",
    },
    organization: {
      id: String(organization?._id || payslip.organizationId),
      organizationName: organization?.organizationName || "",
      brandName: organization?.brandName || "",
      logoUrl: organization?.logoUrl || null,
    },
    earnings,
    deductions,
    components,
    lop: {
      days: payslip.finalLopDays || 0,
      amount: payslip.lopAmount || 0,
    },
    totals: {
      gross: payslip.gross || 0,
      structureDeductions: payslip.structureDeductions || 0,
      netPay: payslip.netPay || 0,
    },
    attendance: {
      calendarDays: payslip.attendance?.calendarDays ?? 0,
      weeklyOffDays: payslip.attendance?.weeklyOffDays ?? 0,
      holidayDays: payslip.attendance?.holidayDays ?? 0,
      presentDays: payslip.attendance?.presentDays ?? 0,
      paidLeaveDays: payslip.attendance?.paidLeaveDays ?? 0,
      unpaidLeaveDays: payslip.attendance?.unpaidLeaveDays ?? 0,
      absentDays: payslip.attendance?.absentDays ?? 0,
      suggestedLopDays: payslip.attendance?.suggestedLopDays ?? 0,
      finalLopDays: payslip.finalLopDays || 0,
    },
    bank: {
      accountHolderName: payslip.bankSnapshot?.accountHolderName || "",
      accountMasked: maskAccount(payslip.bankSnapshot?.accountNumber),
      ifsc: payslip.bankSnapshot?.ifsc || "",
      bankName: payslip.bankSnapshot?.bankName || "",
    },
    meta: {
      generatedAt: payslip.updatedAt || payslip.createdAt || null,
      status: payslip.status,
      footerNote: "This is a system generated salary slip.",
    },
  };

  return {
    templateId: layout.templateId,
    layout,
    data,
  };
};
