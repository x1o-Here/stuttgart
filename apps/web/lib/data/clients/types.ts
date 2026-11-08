import type { ClientStatus } from "@stuttgart/shared/schemas/clients";

export type {
  ClientInput,
  ClientStatus,
} from "@stuttgart/shared/schemas/clients";

/** A client as the screens use it, whichever data source it came from. */
export type Client = {
  id: string;
  name: string;
  address: string;
  vatNo: string;
  contactNo: string;
  status: ClientStatus;
  /** Invoices that are not paid or cancelled. */
  activeInvoiceCount: number;
  /** Sum of outstanding amounts on those invoices. */
  outstandingInvoiceAmount: number;
};
