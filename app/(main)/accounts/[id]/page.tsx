"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { transactionsColumns } from "./components/transactions-columns";
import { TransactionsDataTable } from "./components/transactions-table";

export default function AccountPage() {
  const params = useParams();
  const { id } = params;

  const { accounts } = useAccountsContext();
  const account = accounts.find((acc) => acc.id === id);

  const formattedAmount = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "LKR",
  }).format(account?.balance || 0);

  useEffect(() => {
    console.log("Account details:", account);
  }, [account]);

  return (
    <div className="min-h-screen p-4 flex items-center justify-center font-sans">
      <div className="w-full min-h-[calc(100vh-2rem)] p-4 bg-zinc-100 rounded-lg flex flex-col">
        <div className="mt-2 p-4 bg-white rounded-md flex items-center justify-between gap-4 shrink-0">
          <p className="text-black text-3xl font-semibold">{account?.name}</p>
          <p className="text-black text-xl font-light">{formattedAmount}</p>
        </div>

        <div className="mt-2 p-4 bg-white rounded-md flex flex-col flex-1 min-h-0">
          <TransactionsDataTable
            columns={transactionsColumns}
            data={account?.transactions || []}
          />
        </div>
      </div>
    </div>
  );
}
