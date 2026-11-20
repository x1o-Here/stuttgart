export type CompanyRecord = {
  id: string;
  name: string;
  address: string;
  telephoneNo: string;
  tin: string;
  /** Organization setting; false = no VAT on this company's invoices. */
  vatRegistered: boolean;
  entityStatus: boolean;
};

export function mapCompanyDoc(
  id: string,
  data: Record<string, unknown>,
): CompanyRecord {
  return {
    id,
    name: typeof data.name === "string" ? data.name : "",
    address: typeof data.address === "string" ? data.address : "",
    telephoneNo: typeof data.telephoneNo === "string" ? data.telephoneNo : "",
    tin: typeof data.tin === "string" ? data.tin : "",
    vatRegistered: data.vatRegistered !== false,
    entityStatus: data.entityStatus !== false,
  };
}
