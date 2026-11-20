import {
  outstandingFromPayments,
  roundMoney,
  VAT_RATE,
} from "@/lib/invoices/money";

// Shared money helpers now live in lib/invoices/money; re-exported for callers.
export { outstandingFromPayments, roundMoney, VAT_RATE };

import {
  DEFAULT_AMOUNT_FORMULA,
  evaluateAmountFormula,
  type FormulaNode,
  parseAmountFormula,
} from "@stuttgart/shared/invoices/amount-formula";
import { toDate } from "@/lib/helpers/to-date";

export { DEFAULT_AMOUNT_FORMULA };

export type TemplateColumnType =
  | "text"
  | "number"
  | "decimal"
  | "date"
  | "vehicle";

export type TemplateColumn = {
  id: string;
  key: string;
  label: string;
  type: TemplateColumnType;
  required: boolean;
  system: boolean;
};

export type SupplierInformation = {
  name: string;
  address: string;
  vatNo: string;
  contactNo: string;
};

/** Company master fields used as invoice supplier details. */
export type CompanySupplierSource = {
  name: string;
  address?: string;
  tin?: string;
  telephoneNo?: string;
};

export type SigningInformation = {
  leftLabel: string;
  leftName: string;
  rightLabel: string;
  rightName: string;
};

export type InvoiceTemplateSettings = {
  /**
   * Row amount formula referring to columns as `{key}`, e.g.
   * `{quantity} * {rate}`. `null` means the amount is typed in by hand
   * (invoices issued before formulas existed).
   */
  amountFormula: string | null;
};

export type InvoiceTemplate = {
  supplier: SupplierInformation;
  signing: SigningInformation;
  /** In display order. */
  columns: TemplateColumn[];
  settings: InvoiceTemplateSettings;
};

export type ClientSnapshot = {
  id: string;
  name: string;
  address: string;
  vatNo: string;
  contactNo: string;
};

export type DeliveryDetails = {
  date: Date;
  /** Place of supply */
  address: string;
  /** Additional information if any */
  reference: string;
};

/** Display order of templates saved before columns could be reordered. */
const LEGACY_LEADING_KEYS = ["no", "date", "vehicleNo"];
const LEGACY_TRAILING_KEYS = ["rate", "amount"];

/**
 * Where a base column added after a template was saved goes in by default:
 * Description after Vehicle No, Quantity before Rate.
 */
const INSERT_AFTER: Record<string, string> = { description: "vehicleNo" };
const INSERT_BEFORE: Record<string, string> = { quantity: "rate" };
/** Base columns old invoices didn't have; they are not added to snapshots. */
const LATER_SYSTEM_KEYS = new Set(["description", "quantity"]);

export function supplierFromCompany(
  company?: CompanySupplierSource | null,
): SupplierInformation {
  return {
    name: company?.name ?? "",
    address: company?.address ?? "",
    vatNo: company?.tin ?? "",
    contactNo: company?.telephoneNo ?? "",
  };
}

export function withCompanySupplier(
  template: InvoiceTemplate,
  company?: CompanySupplierSource | null,
): InvoiceTemplate {
  if (!company) return template;
  return {
    ...template,
    supplier: supplierFromCompany(company),
  };
}

// ── Amount formula ───────────────────────────────────────────────────────

/** Columns a formula may use: numbers and decimals, except No and Amount. */
export function formulaColumns(columns: TemplateColumn[]): TemplateColumn[] {
  return columns.filter(
    (column) =>
      (column.type === "number" || column.type === "decimal") &&
      column.key !== "amount" &&
      column.key !== "no",
  );
}

/** `{key}` → `[Label]` for editing. */
export function formulaToDisplay(
  formula: string,
  columns: TemplateColumn[],
): string {
  const labels = new Map(columns.map((column) => [column.key, column.label]));
  return formula.replace(
    /\{([^}]*)\}/g,
    (_match, key: string) => `[${labels.get(key.trim()) ?? key.trim()}]`,
  );
}

/** `[Label]` → `{key}` for storage; unknown labels are kept as-is so parsing reports them. */
export function formulaFromDisplay(
  display: string,
  columns: TemplateColumn[],
): string {
  const keys = new Map(
    columns.map((column) => [column.label.trim().toLowerCase(), column.key]),
  );
  return display.replace(
    /\[([^\]]*)\]/g,
    (_match, label: string) =>
      `{${keys.get(label.trim().toLowerCase()) ?? label.trim()}}`,
  );
}

export type AmountCalculator = {
  /** Column keys the formula reads. */
  refs: string[];
  calculate: (values: Record<string, number>) => number;
};

/**
 * The template's row amount calculator, or null when the amount is entered
 * by hand (no formula, or a formula that no longer parses).
 */
export function amountCalculator(
  template: InvoiceTemplate,
): AmountCalculator | null {
  const formula = template.settings.amountFormula;
  if (!formula) return null;
  const parsed = parseAmountFormula(
    formula,
    formulaColumns(template.columns).map((column) => column.key),
  );
  if (!parsed.ok) return null;
  const ast: FormulaNode = parsed.ast;
  return {
    refs: parsed.refs,
    calculate: (values) => evaluateAmountFormula(ast, values),
  };
}

export function getDefaultInvoiceTemplate(
  company?: CompanySupplierSource | string | null,
): InvoiceTemplate {
  const supplier =
    typeof company === "string"
      ? { name: company, address: "", vatNo: "", contactNo: "" }
      : supplierFromCompany(company);

  return {
    supplier,
    signing: { ...EMPTY_SIGNING_INFORMATION },
    columns: DEFAULT_TEMPLATE_COLUMNS.map((column) => ({ ...column })),
    settings: { amountFormula: DEFAULT_AMOUNT_FORMULA },
  };
}

/**
 * VAT stored on an invoice. A stored 0 is kept (invoices of companies not
 * registered for VAT); only records missing the field fall back to 18%.
 */
export function storedVatAmount(raw: unknown, supplyValue: number): number {
  if (raw !== undefined && raw !== null && raw !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return roundMoney(parsed);
  }
  return calculateInvoiceTotals(supplyValue).vatAmount;
}

/**
 * Whether an issued invoice was charged VAT. Invoices of companies not
 * registered for VAT carry 0 VAT with a non-zero value of supply.
 */
export function invoiceHasVat(invoice: {
  totalAmount: number;
  vatAmount: number;
}): boolean {
  return invoice.vatAmount !== 0 || invoice.totalAmount === 0;
}

export type InvoiceTotals = {
  supplyValue: number;
  vatAmount: number;
  totalIncludingVat: number;
};

/** Companies not registered for VAT (`vatRegistered` false) charge none. */
export function calculateInvoiceTotals(
  supplyValue: number,
  vatRegistered = true,
): InvoiceTotals {
  const safeSupply = Number.isFinite(supplyValue) ? supplyValue : 0;
  const vatAmount = vatRegistered
    ? Math.round(safeSupply * VAT_RATE * 100) / 100
    : 0;
  const totalIncludingVat = Math.round((safeSupply + vatAmount) * 100) / 100;
  return {
    supplyValue: Math.round(safeSupply * 100) / 100,
    vatAmount,
    totalIncludingVat,
  };
}

const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];
const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  const ten = Math.floor(n / 10);
  const one = n % 10;
  return `${TENS[ten]}${one ? ` ${ONES[one]}` : ""}`.trim();
}

function threeDigits(n: number): string {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  if (hundred && rest) return `${ONES[hundred]} Hundred ${twoDigits(rest)}`;
  if (hundred) return `${ONES[hundred]} Hundred`;
  return twoDigits(rest);
}

/** Simple English amount-in-words for invoice totals. */
export function amountInWords(amount: number): string {
  const safe = Math.round((Number.isFinite(amount) ? amount : 0) * 100) / 100;
  const whole = Math.floor(safe);
  const cents = Math.round((safe - whole) * 100);

  if (whole === 0 && cents === 0) return "Zero Only";

  const parts: string[] = [];
  const billion = Math.floor(whole / 1_000_000_000);
  const million = Math.floor((whole % 1_000_000_000) / 1_000_000);
  const thousand = Math.floor((whole % 1_000_000) / 1_000);
  const remainder = whole % 1_000;

  if (billion) parts.push(`${threeDigits(billion)} Billion`);
  if (million) parts.push(`${threeDigits(million)} Million`);
  if (thousand) parts.push(`${threeDigits(thousand)} Thousand`);
  if (remainder) parts.push(threeDigits(remainder));

  let words = parts.join(" ").trim() || "Zero";
  if (cents > 0) {
    words = `${words} and ${twoDigits(cents)} Cents`;
  }
  return `${words} Only`;
}

export type InvoiceLineItem = {
  no: number;
  date: Date;
  vehicleNo: string;
  description: string;
  quantity: number;
  rate: number;
  amount: number;
  customValues: Record<string, string | number>;
};

export type InvoiceStatus =
  | "draft"
  | "issued"
  | "paid"
  | "partial"
  | "overdue"
  | "cancelled";

export type ClientInvoiceDocument = {
  id: string;
  taxInvoiceNo: string;
  date: Date;
  delivery: DeliveryDetails;
  client: ClientSnapshot;
  template: InvoiceTemplate;
  lineItems: InvoiceLineItem[];
  /** Total value of supply (sum of line amounts, before VAT). */
  totalAmount: number;
  vatAmount: number;
  totalIncludingVat: number;
  outstandingAmount: number;
  status: InvoiceStatus;
};

export type InvoicePayment = {
  id: string;
  date: Date;
  description: string;
  /** Optional payment reference (e.g. cheque number). */
  chequeNo: string;
  amount: number;
  creditingAccountId: string;
  creditingAccountName: string;
  debitingAccountId: string;
  debitingAccountName: string;
  /** Shared id for the dual-entry account transactions. */
  transactionId: string;
  createdAt: Date | null;
};

export function defaultInvoicePaymentDescription(invoiceNo: string): string {
  const no = invoiceNo.trim() || "—";
  return `Payment for invoice ${no}`;
}

/** Prefer stored outstanding; never treat 0 as missing. */
export function resolveOutstandingAmount(
  raw: unknown,
  totalIncludingVat: number,
): number {
  if (raw !== undefined && raw !== null && raw !== "") {
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return roundMoney(Math.max(0, parsed));
  }
  return roundMoney(totalIncludingVat);
}

/** Status while collecting payments (`paid` is shown as Complete in the UI). */
export function deriveStatusFromBalances(
  totalIncludingVat: number,
  outstandingAmount: number,
  currentStatus: InvoiceStatus,
): InvoiceStatus {
  if (currentStatus === "cancelled") {
    return currentStatus;
  }
  const outstanding = roundMoney(outstandingAmount);
  const total = roundMoney(totalIncludingVat);
  if (total > 0 && outstanding <= 0) return "paid";
  if (outstanding < total) return "partial";
  return currentStatus === "overdue" ? "overdue" : "issued";
}

export function canCompleteInvoice(
  totalIncludingVat: number,
  outstandingAmount: number,
  status: InvoiceStatus,
): boolean {
  if (status === "paid" || status === "cancelled") return false;
  return (
    roundMoney(outstandingAmount) <= 0 && roundMoney(totalIncludingVat) > 0
  );
}

export function mapInvoicePayment(
  id: string,
  data: Record<string, unknown>,
): InvoicePayment {
  const chequeNo =
    typeof data.chequeNo === "string" ? data.chequeNo.trim() : "";
  const legacyInvoiceNo =
    typeof data.invoiceNo === "string"
      ? data.invoiceNo
      : typeof data.taxInvoiceNo === "string"
        ? data.taxInvoiceNo
        : "";
  const descriptionRaw = data.description ?? data.note ?? data.reference ?? "";
  const description =
    typeof descriptionRaw === "string"
      ? descriptionRaw.trim()
      : String(descriptionRaw ?? "").trim();
  const resolvedDescription =
    description || defaultInvoicePaymentDescription(legacyInvoiceNo);

  const creditNameRaw = data.creditingAccountName ?? "";
  const creditingAccountName =
    typeof creditNameRaw === "string"
      ? creditNameRaw.trim()
      : String(creditNameRaw ?? "").trim();

  return {
    id,
    date: toDate(data.date) ?? new Date(0),
    description: resolvedDescription,
    chequeNo,
    amount: Number(data.amount) || 0,
    creditingAccountId:
      typeof data.creditingAccountId === "string"
        ? data.creditingAccountId
        : "",
    creditingAccountName,
    debitingAccountId:
      typeof data.debitingAccountId === "string" ? data.debitingAccountId : "",
    debitingAccountName:
      typeof data.debitingAccountName === "string"
        ? data.debitingAccountName
        : "",
    transactionId:
      typeof data.transactionId === "string" ? data.transactionId : "",
    createdAt: toDate(data.createdAt) ?? null,
  };
}

export const DEFAULT_TEMPLATE_COLUMNS: TemplateColumn[] = [
  {
    id: "system-no",
    key: "no",
    label: "No",
    type: "number",
    required: true,
    system: true,
  },
  {
    id: "system-date",
    key: "date",
    label: "Date",
    type: "date",
    required: true,
    system: true,
  },
  {
    id: "system-vehicle",
    key: "vehicleNo",
    label: "Vehicle No",
    type: "vehicle",
    required: true,
    system: true,
  },
  {
    id: "system-description",
    key: "description",
    label: "Description",
    type: "text",
    required: false,
    system: true,
  },
  {
    id: "system-quantity",
    key: "quantity",
    label: "Quantity",
    type: "decimal",
    required: true,
    system: true,
  },
  {
    id: "system-rate",
    key: "rate",
    label: "Rate",
    type: "decimal",
    required: true,
    system: true,
  },
  {
    id: "system-amount",
    key: "amount",
    label: "Amount",
    type: "decimal",
    required: true,
    system: true,
  },
];

export const EMPTY_SIGNING_INFORMATION: SigningInformation = {
  leftLabel: "Prepared by",
  leftName: "",
  rightLabel: "Authorized by",
  rightName: "",
};

function mapColumn(value: unknown): TemplateColumn | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  const validTypes: TemplateColumnType[] = [
    "text",
    "number",
    "decimal",
    "date",
    "vehicle",
  ];
  const type = validTypes.includes(data.type as TemplateColumnType)
    ? (data.type as TemplateColumnType)
    : "text";
  const key = typeof data.key === "string" ? data.key : "";
  const label = typeof data.label === "string" ? data.label : "";
  if (!key || !label) return null;

  return {
    id: typeof data.id === "string" ? data.id : key,
    key,
    label,
    type,
    required: data.required === true,
    system: data.system === true,
  };
}

/**
 * Stored order and labels; base (system) columns keep their key, type and
 * flags from the defaults but their label can be renamed.
 *
 * - Templates saved before columns could be reordered (no Quantity stored)
 *   get their old display order: No, Date, Vehicle No, custom…, Rate, Amount.
 * - A base column missing from a client template is added at its default
 *   spot (Description after Vehicle No, Quantity before Rate). If the
 *   template already has a custom column with that name, that column
 *   becomes the base column in place instead of a duplicate appearing.
 * - Invoice snapshots never gain Description/Quantity, so old invoices
 *   print as issued.
 */
function normalizeColumns(
  stored: TemplateColumn[],
  snapshot: boolean,
): TemplateColumn[] {
  const defaults = new Map(
    DEFAULT_TEMPLATE_COLUMNS.map((column) => [column.key, column]),
  );
  const seen = new Set<string>();
  let columns: TemplateColumn[] = [];
  for (const column of stored) {
    if (seen.has(column.key)) continue;
    const systemColumn = defaults.get(column.key);
    if (column.system && !systemColumn) continue;
    seen.add(column.key);
    columns.push(
      systemColumn
        ? { ...systemColumn, label: column.label.trim() || systemColumn.label }
        : column,
    );
  }

  if (!seen.has("quantity")) {
    const byKey = new Map(columns.map((column) => [column.key, column]));
    const pick = (keys: string[]) =>
      keys
        .map((key) => byKey.get(key))
        .filter((column): column is TemplateColumn => !!column);
    columns = [
      ...pick(LEGACY_LEADING_KEYS),
      ...columns.filter(
        (column) =>
          !LEGACY_LEADING_KEYS.includes(column.key) &&
          !LEGACY_TRAILING_KEYS.includes(column.key),
      ),
      ...pick(LEGACY_TRAILING_KEYS),
    ];
  }

  for (const base of DEFAULT_TEMPLATE_COLUMNS) {
    if (seen.has(base.key)) continue;
    if (snapshot && LATER_SYSTEM_KEYS.has(base.key)) continue;

    const sameName = columns.findIndex(
      (column) =>
        !column.system &&
        column.label.trim().toLowerCase() === base.label.toLowerCase(),
    );
    if (sameName >= 0 && !snapshot) {
      columns[sameName] = { ...base, label: columns[sameName].label.trim() };
      continue;
    }

    const after = INSERT_AFTER[base.key];
    const before = INSERT_BEFORE[base.key];
    const afterIndex = after
      ? columns.findIndex((column) => column.key === after)
      : -1;
    const beforeIndex = before
      ? columns.findIndex((column) => column.key === before)
      : -1;
    if (afterIndex >= 0) columns.splice(afterIndex + 1, 0, { ...base });
    else if (beforeIndex >= 0) columns.splice(beforeIndex, 0, { ...base });
    else columns.push({ ...base });
  }
  return columns;
}

/**
 * `snapshot`: the template copy stored on an invoice. Snapshots from before
 * formulas existed keep hand-entered amounts; client templates default to
 * Quantity × Rate.
 */
export function mapInvoiceTemplate(
  data: Record<string, unknown>,
  { snapshot = false }: { snapshot?: boolean } = {},
): InvoiceTemplate {
  const supplier = (data.supplier ?? {}) as Record<string, unknown>;
  const signing = (data.signing ?? {}) as Record<string, unknown>;
  const settings = (data.settings ?? {}) as Record<string, unknown>;
  const storedColumns = Array.isArray(data.columns)
    ? data.columns
        .map(mapColumn)
        .filter((column): column is TemplateColumn => !!column)
    : [];
  const amountFormula =
    typeof settings.amountFormula === "string" && settings.amountFormula.trim()
      ? settings.amountFormula
      : "amountFormula" in settings || snapshot
        ? null
        : DEFAULT_AMOUNT_FORMULA;

  return {
    supplier: {
      name: typeof supplier.name === "string" ? supplier.name : "",
      address: typeof supplier.address === "string" ? supplier.address : "",
      vatNo: typeof supplier.vatNo === "string" ? supplier.vatNo : "",
      contactNo:
        typeof supplier.contactNo === "string" ? supplier.contactNo : "",
    },
    signing: {
      leftLabel:
        typeof signing.leftLabel === "string"
          ? signing.leftLabel
          : EMPTY_SIGNING_INFORMATION.leftLabel,
      leftName: typeof signing.leftName === "string" ? signing.leftName : "",
      rightLabel:
        typeof signing.rightLabel === "string"
          ? signing.rightLabel
          : EMPTY_SIGNING_INFORMATION.rightLabel,
      rightName: typeof signing.rightName === "string" ? signing.rightName : "",
    },
    columns: normalizeColumns(storedColumns, snapshot),
    settings: { amountFormula },
  };
}

export function mapClientInvoiceDocument(
  id: string,
  data: Record<string, unknown>,
): ClientInvoiceDocument {
  const delivery = (data.delivery ?? {}) as Record<string, unknown>;
  const client = (data.client ?? {}) as Record<string, unknown>;
  const lineItems = Array.isArray(data.lineItems) ? data.lineItems : [];
  const supplyValue = Number(data.totalAmount) || 0;
  const totals = calculateInvoiceTotals(supplyValue);

  return {
    id,
    taxInvoiceNo:
      typeof data.taxInvoiceNo === "string" ? data.taxInvoiceNo : "",
    date: toDate(data.date) ?? new Date(0),
    delivery: {
      date: toDate(delivery.date) ?? new Date(0),
      address: typeof delivery.address === "string" ? delivery.address : "",
      reference:
        typeof delivery.reference === "string" ? delivery.reference : "",
    },
    client: {
      id: typeof client.id === "string" ? client.id : "",
      name: typeof client.name === "string" ? client.name : "",
      address: typeof client.address === "string" ? client.address : "",
      vatNo: typeof client.vatNo === "string" ? client.vatNo : "",
      contactNo: typeof client.contactNo === "string" ? client.contactNo : "",
    },
    template: mapInvoiceTemplate(
      (data.template ?? {}) as Record<string, unknown>,
      { snapshot: true },
    ),
    lineItems: lineItems.map((value, index) => {
      const item = value as Record<string, unknown>;
      return {
        no: Number(item.no) || index + 1,
        date: toDate(item.date) ?? new Date(0),
        vehicleNo: typeof item.vehicleNo === "string" ? item.vehicleNo : "",
        description:
          typeof item.description === "string" ? item.description : "",
        quantity:
          item.quantity === undefined || item.quantity === null
            ? 1
            : Number(item.quantity) || 0,
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || 0,
        customValues:
          item.customValues && typeof item.customValues === "object"
            ? (item.customValues as Record<string, string | number>)
            : {},
      };
    }),
    totalAmount: supplyValue,
    vatAmount: storedVatAmount(data.vatAmount, supplyValue),
    totalIncludingVat:
      Number(data.totalIncludingVat) || totals.totalIncludingVat,
    outstandingAmount: (() => {
      const total = Number(data.totalIncludingVat) || totals.totalIncludingVat;
      const status = (data.status as InvoiceStatus) || "issued";
      if (status === "paid") return 0;
      return resolveOutstandingAmount(data.outstandingAmount, total);
    })(),
    status: (data.status as InvoiceStatus) || "issued",
  };
}

export function createCustomColumnKey(label: string): string {
  const slug = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const randomSuffix = Math.random().toString(36).slice(2, 8);
  return `custom_${slug || "column"}_${Date.now().toString(36)}_${randomSuffix}`;
}
