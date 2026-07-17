export type Transaction = {
  id: string;
  date: Date;
  description: string;
  amount: number;
  type: "debit" | "credit";
  department: string;
  vehicle: string;
  voucher: number;
  createdAt?: Date;
  tags?: string[];
  runningBalance?: number;
};

export type Account = {
  id: string;
  name: string;
  accountType?: string;
  balance: number;
  transactions: Transaction[];
  createdAt?: Date;
  initialBalance: number;
};
