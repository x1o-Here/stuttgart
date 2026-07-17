"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { zodResolver } from "@hookform/resolvers/zod";
import { collection, doc, serverTimestamp, Timestamp, writeBatch, increment, arrayUnion } from "firebase/firestore";
import { Edit2, MoreHorizontal, Plus, Trash2 } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import * as z from "zod";
import { db } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/auth-context";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { Separator } from "@/components/ui/separator";
import { useLookupStore } from "@/stores/use-lookup-store";
import CalendarPopover from "../../vehicle/[id]/components/calendar-popover";
import type { Transaction } from "./columns";

const formSchema = z.object({
    date: z.date(),
    description: z.string().min(1, "Description is required"),
    department: z.string().min(1, "Department is required"),
    vehicle: z.string().optional(),
    voucherNo: z.number().min(0, "Voucher number must be positive"),
    creditingAccount: z.string().min(1, "Crediting Account is required"),
    debitingAccount: z.string().min(1, "Debitng Account is required"),
    amount: z.number().min(0, "Amount must be positive"),
});

type FormOutput = z.infer<typeof formSchema>;

interface TransactionActionsProps {
    transaction: Transaction;
}

export function TransactionActions({ transaction }: TransactionActionsProps) {
    const [openDropdown, setOpenDropdown] = useState(false);
    const [editDialogOpen, setEditDialogOpen] = useState(false);

    const { accounts } = useAccountsContext();
    const { user, activeCompany } = useAuth();
    const router = useRouter();

    const departments = useLookupStore((state) => state.departments);
    const vehicles = useLookupStore((state) => state.vehicles);

    const form = useForm<FormOutput>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: transaction.date || new Date(),
            description: transaction.description || "",
            department: transaction.department || "",
            vehicle: transaction.vehicle || "",
            voucherNo: transaction.voucher || 0,
            creditingAccount: transaction.creditingAccountId || "",
            debitingAccount: transaction.debitingAccountId || "",
            amount: transaction.amount || 0,
        },
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    });

    async function onSubmit(data: FormOutput) {
        try {
            const batch = writeBatch(db);
            const transactionId = transaction.id;

            const reversalTxId = doc(collection(db, "transactions")).id;
            const newTxId = doc(collection(db, "transactions")).id;
            const reversalDate = transaction.date || data.date;
            const reversalCreatedAt = Timestamp.fromMillis(Date.now());
            const correctedCreatedAt = Timestamp.fromMillis(Date.now() + 500);

            // 1. Reverse the original transaction
            if (transaction.creditingAccountId) {
                const revDebitTxRef = doc(db, "companies", activeCompany, "accounts", transaction.creditingAccountId, "transactions", reversalTxId);
                batch.set(revDebitTxRef, {
                    date: reversalDate,
                    amount: transaction.amount,
                    type: "debit",
                    department: transaction.department,
                    vehicle: transaction.vehicle,
                    voucherNo: transaction.voucher,
                    description: `Reversal: ${transaction.description}`,
                    tags: ["reversal"],
                    createdAt: reversalCreatedAt,
                    updatedAt: reversalCreatedAt,
                });

                const oldCreditAccountRef = doc(db, "companies", activeCompany, "accounts", transaction.creditingAccountId);
                batch.update(oldCreditAccountRef, { balance: increment(-transaction.amount) });

                const oldCreditTxRef = doc(db, "companies", activeCompany, "accounts", transaction.creditingAccountId, "transactions", transactionId);
                batch.update(oldCreditTxRef, {
                    tags: arrayUnion("corrected"),
                    updatedAt: reversalCreatedAt
                });
            }

            if (transaction.debitingAccountId) {
                const revCreditTxRef = doc(db, "companies", activeCompany, "accounts", transaction.debitingAccountId, "transactions", reversalTxId);
                batch.set(revCreditTxRef, {
                    date: reversalDate,
                    amount: transaction.amount,
                    type: "credit",
                    department: transaction.department,
                    vehicle: transaction.vehicle,
                    voucherNo: transaction.voucher,
                    description: `Reversal: ${transaction.description}`,
                    tags: ["reversal"],
                    createdAt: reversalCreatedAt,
                    updatedAt: reversalCreatedAt,
                });

                const oldDebitAccountRef = doc(db, "companies", activeCompany, "accounts", transaction.debitingAccountId);
                batch.update(oldDebitAccountRef, { balance: increment(transaction.amount) });

                const oldDebitTxRef = doc(db, "companies", activeCompany, "accounts", transaction.debitingAccountId, "transactions", transactionId);
                batch.update(oldDebitTxRef, {
                    tags: arrayUnion("corrected"),
                    updatedAt: reversalCreatedAt
                });
            }

            // 2. Add the new transaction entry
            const newCreditTxRef = doc(db, "companies", activeCompany, "accounts", data.creditingAccount, "transactions", newTxId);
            batch.set(newCreditTxRef, {
                date: data.date,
                amount: data.amount,
                type: "credit",
                department: data.department,
                vehicle: data.vehicle,
                voucherNo: data.voucherNo,
                description: data.description,
                createdAt: correctedCreatedAt,
                updatedAt: correctedCreatedAt,
            });

            const newCreditAccountRef = doc(db, "companies", activeCompany, "accounts", data.creditingAccount);
            batch.update(newCreditAccountRef, { balance: increment(data.amount) });

            const newDebitTxRef = doc(db, "companies", activeCompany, "accounts", data.debitingAccount, "transactions", newTxId);
            batch.set(newDebitTxRef, {
                date: data.date,
                amount: data.amount,
                type: "debit",
                department: data.department,
                vehicle: data.vehicle,
                voucherNo: data.voucherNo,
                description: data.description,
                createdAt: correctedCreatedAt,
                updatedAt: correctedCreatedAt,
            });

            const newDebitAccountRef = doc(db, "companies", activeCompany, "accounts", data.debitingAccount);
            batch.update(newDebitAccountRef, { balance: increment(-data.amount) });

            const auditLogRef = doc(collection(db, "auditLogs"));
            batch.set(auditLogRef, {
                userId: user?.uid,
                transactionId: newTxId,
                action: "update-with-reversal",
                description: `Transaction reversed and updated`,
                companyId: activeCompany,
                entityStatus: true,
                createdAt: correctedCreatedAt,
            });

            await batch.commit();

            setEditDialogOpen(false);
            setOpenDropdown(false);
        } catch (err) {
            console.error("Failed to edit transaction:", err);
        }
    }

    async function handleDelete() {
        if (!window.confirm("Are you sure you want to delete this transaction? This action will reverse the transaction and mark it as deleted.")) {
            return;
        }

        try {
            const batch = writeBatch(db);
            const transactionId = transaction.id;
            const reversalTxId = doc(collection(db, "transactions")).id;

            if (transaction.creditingAccountId) {
                const revDebitTxRef = doc(db, "companies", activeCompany, "accounts", transaction.creditingAccountId, "transactions", reversalTxId);
                batch.set(revDebitTxRef, {
                    date: transaction.date || new Date(),
                    amount: transaction.amount,
                    type: "debit",
                    department: transaction.department,
                    vehicle: transaction.vehicle,
                    voucherNo: transaction.voucher,
                    description: `Reversal: ${transaction.description}`,
                    tags: ["reversal"],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                const oldCreditAccountRef = doc(db, "companies", activeCompany, "accounts", transaction.creditingAccountId);
                batch.update(oldCreditAccountRef, { balance: increment(-transaction.amount) });

                const oldCreditTxRef = doc(db, "companies", activeCompany, "accounts", transaction.creditingAccountId, "transactions", transactionId);
                batch.update(oldCreditTxRef, {
                    tags: arrayUnion("deleted"),
                    updatedAt: serverTimestamp()
                });
            }

            if (transaction.debitingAccountId) {
                const revCreditTxRef = doc(db, "companies", activeCompany, "accounts", transaction.debitingAccountId, "transactions", reversalTxId);
                batch.set(revCreditTxRef, {
                    date: transaction.date || new Date(),
                    amount: transaction.amount,
                    type: "credit",
                    department: transaction.department,
                    vehicle: transaction.vehicle,
                    voucherNo: transaction.voucher,
                    description: `Reversal: ${transaction.description}`,
                    tags: ["reversal"],
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp(),
                });

                const oldDebitAccountRef = doc(db, "companies", activeCompany, "accounts", transaction.debitingAccountId);
                batch.update(oldDebitAccountRef, { balance: increment(transaction.amount) });

                const oldDebitTxRef = doc(db, "companies", activeCompany, "accounts", transaction.debitingAccountId, "transactions", transactionId);
                batch.update(oldDebitTxRef, {
                    tags: arrayUnion("deleted"),
                    updatedAt: serverTimestamp()
                });
            }

            // Audit log for the edits
            const auditLogRef = doc(collection(db, "auditLogs"));
            batch.set(auditLogRef, {
                userId: user?.uid,
                transactionId: reversalTxId,
                action: "delete",
                description: `Transaction deleted and reversed`,
                companyId: activeCompany,
                entityStatus: false,
                createdAt: serverTimestamp(),
            });

            await batch.commit();

            setOpenDropdown(false);
        } catch (err) {
            console.error("Failed to delete transaction:", err);
        }
    }

    const hasRestrictedTags = transaction.tags?.includes("corrected") || transaction.tags?.includes("reversal") || transaction.tags?.includes("deleted");

    if (hasRestrictedTags) {
        return null;
    }

    return (
        <>
            <DropdownMenu open={openDropdown} onOpenChange={setOpenDropdown}>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon">
                        <MoreHorizontal className="h-4 w-4" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                    <DropdownMenuItem
                        onClick={() => {
                            form.reset({
                                date: transaction.date || new Date(),
                                description: transaction.description || "",
                                department: transaction.department || "",
                                vehicle: transaction.vehicle || "",
                                voucherNo: transaction.voucher || 0,
                                creditingAccount: transaction.creditingAccountId || "",
                                debitingAccount: transaction.debitingAccountId || "",
                                amount: transaction.amount || 0,
                            });
                            setEditDialogOpen(true);
                            setOpenDropdown(false);
                        }}
                    >
                        <Edit2 className="mr-2 h-4 w-4" />
                        Edit Transaction
                    </DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={handleDelete}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Transaction
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
                <DialogContent className="min-w-2xl">
                    <DialogHeader className="pb-4">
                        <DialogTitle>Edit Transaction</DialogTitle>
                    </DialogHeader>
                    <form id="edit-transaction-form" onSubmit={form.handleSubmit(onSubmit)}>
                        <FieldGroup>
                            <div className="grid grid-cols-2 gap-x-6 gap-y-6">
                                <Controller
                                    name="date"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="date">Date</FieldLabel>
                                            <CalendarPopover
                                                value={field.value}
                                                onChange={(date) => {
                                                    if (date) field.onChange(date);
                                                }}
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="amount"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="amount">Amount</FieldLabel>
                                            <Input
                                                id="amount"
                                                type="number"
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                placeholder="Amount"
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="department"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="department">Department</FieldLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    if (value === "__new__") {
                                                        router.push("/settings/departments");
                                                        return;
                                                    }

                                                    field.onChange(value);
                                                }}
                                                defaultValue={field.value}
                                                value={field.value}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select an department" />
                                                </SelectTrigger>
                                                <SelectContent position="popper" side="bottom">
                                                    {departments.map((department) => (
                                                        <SelectItem key={department.id} value={department.name}>
                                                            {department.name}
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value="__new__">
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Create new department
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="vehicle"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="vehicle">Vehicle</FieldLabel>
                                            <Select
                                                onValueChange={(value) => {
                                                    if (value === "__new__") {
                                                        router.push("/settings/vehicles");
                                                        return;
                                                    }

                                                    field.onChange(value === "__none__" ? "" : value);
                                                }}
                                                defaultValue={field.value}
                                                value={field.value || undefined}
                                            >
                                                <SelectTrigger className="w-full">
                                                    <SelectValue placeholder="Select a vehicle" />
                                                </SelectTrigger>
                                                <SelectContent position="popper" side="bottom">
                                                    <SelectItem value="__none__">
                                                        No vehicle
                                                    </SelectItem>
                                                    {vehicles.map((vehicle) => (
                                                        <SelectItem key={vehicle.id} value={vehicle.name}>
                                                            {vehicle.name}
                                                        </SelectItem>
                                                    ))}
                                                    <SelectItem value="__new__">
                                                        <Plus className="mr-2 h-4 w-4" />
                                                        Create new vehicle
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="voucherNo"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="voucherNo">Voucher No</FieldLabel>
                                            <Input
                                                id="voucherNo"
                                                type="number"
                                                {...field}
                                                onChange={(e) => field.onChange(Number(e.target.value))}
                                                placeholder="Voucher No"
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />

                                <Separator className="col-span-2" />

                                <Controller
                                    name="debitingAccount"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field className="col-start-1" data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="debitingAccount">Debitng Account</FieldLabel>
                                            <Select
                                                name={field.name}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger
                                                    id="debitingAccount"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    aria-invalid={fieldState.invalid}
                                                >
                                                    <SelectValue placeholder="Select an option" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map((account) => (
                                                        <SelectItem key={account.id} value={account.id}>
                                                            {account.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="creditingAccount"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid}>
                                            <FieldLabel htmlFor="creditingAccount">Crediting Account</FieldLabel>
                                            <Select
                                                name={field.name}
                                                value={field.value}
                                                onValueChange={field.onChange}
                                            >
                                                <SelectTrigger
                                                    id="creditingAccount"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                                    aria-invalid={fieldState.invalid}
                                                >
                                                    <SelectValue placeholder="Select an option" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {accounts.map((account) => (
                                                        <SelectItem key={account.id} value={account.id}>
                                                            {account.name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />

                                <Controller
                                    name="description"
                                    control={form.control}
                                    render={({ field, fieldState }) => (
                                        <Field data-invalid={fieldState.invalid} className="col-span-2">
                                            <FieldLabel htmlFor="description">Description</FieldLabel>
                                            <Textarea
                                                id="description"
                                                {...field}
                                                placeholder="Description"
                                            />
                                            {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                        </Field>
                                    )}
                                />
                            </div>
                        </FieldGroup>
                    </form>
                    <DialogFooter className="mt-4">
                        <Button type="submit" form="edit-transaction-form">Save Changes</Button>
                        <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                            Cancel
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
