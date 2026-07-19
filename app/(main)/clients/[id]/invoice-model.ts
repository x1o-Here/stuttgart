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
  address: string;
  reference: string;
};

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
  totalAmount: number;
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
    totalAmount: Number(data.totalAmount) || 0,
    outstandingAmount: Number(data.outstandingAmount) || 0,
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
