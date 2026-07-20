import { toDate } from "@/lib/helpers/to-date";

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

export type SigningInformation = {
  leftLabel: string;
  leftName: string;
  rightLabel: string;
  rightName: string;
};

export type InvoiceTemplate = {
  supplier: SupplierInformation;
  signing: SigningInformation;
  columns: TemplateColumn[];
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

export const VAT_RATE = 0.18;

export const LEADING_SYSTEM_COLUMN_KEYS = ["no", "date", "vehicleNo"] as const;
export const TRAILING_SYSTEM_COLUMN_KEYS = ["rate", "amount"] as const;

/** No, Date, Vehicle No → custom columns → Rate, Amount */
export function orderedTemplateColumns(
  columns: TemplateColumn[],
): TemplateColumn[] {
  const byKey = new Map(columns.map((column) => [column.key, column]));
  const leading = LEADING_SYSTEM_COLUMN_KEYS.map((key) => byKey.get(key)).filter(
    (column): column is TemplateColumn => !!column,
  );
  const trailing = TRAILING_SYSTEM_COLUMN_KEYS.map((key) =>
    byKey.get(key),
  ).filter((column): column is TemplateColumn => !!column);
  const custom = columns.filter((column) => !column.system);
  return [...leading, ...custom, ...trailing];
}

export function getDefaultInvoiceTemplate(
  companyName = "",
): InvoiceTemplate {
  return {
    supplier: {
      name: companyName,
      address: "",
      vatNo: "",
      contactNo: "",
    },
    signing: { ...EMPTY_SIGNING_INFORMATION },
    columns: DEFAULT_TEMPLATE_COLUMNS.map((column) => ({ ...column })),
  };
}

export type InvoiceTotals = {
  supplyValue: number;
  vatAmount: number;
  totalIncludingVat: number;
};

export function calculateInvoiceTotals(supplyValue: number): InvoiceTotals {
  const safeSupply = Number.isFinite(supplyValue) ? supplyValue : 0;
  const vatAmount = Math.round(safeSupply * VAT_RATE * 100) / 100;
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

export function mapInvoiceTemplate(
  data: Record<string, unknown>,
): InvoiceTemplate {
  const supplier = (data.supplier ?? {}) as Record<string, unknown>;
  const signing = (data.signing ?? {}) as Record<string, unknown>;
  const storedColumns = Array.isArray(data.columns)
    ? data.columns
        .map(mapColumn)
        .filter((column): column is TemplateColumn => !!column)
    : [];
  const customColumns = storedColumns.filter((column) => !column.system);

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
    columns: [...DEFAULT_TEMPLATE_COLUMNS, ...customColumns],
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
    ),
    lineItems: lineItems.map((value, index) => {
      const item = value as Record<string, unknown>;
      return {
        no: Number(item.no) || index + 1,
        date: toDate(item.date) ?? new Date(0),
        vehicleNo: typeof item.vehicleNo === "string" ? item.vehicleNo : "",
        rate: Number(item.rate) || 0,
        amount: Number(item.amount) || 0,
        customValues:
          item.customValues && typeof item.customValues === "object"
            ? (item.customValues as Record<string, string | number>)
            : {},
      };
    }),
    totalAmount: supplyValue,
    vatAmount: Number(data.vatAmount) || totals.vatAmount,
    totalIncludingVat:
      Number(data.totalIncludingVat) || totals.totalIncludingVat,
    outstandingAmount:
      Number(data.outstandingAmount) ||
      Number(data.totalIncludingVat) ||
      totals.totalIncludingVat,
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
