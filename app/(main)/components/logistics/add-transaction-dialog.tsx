'use client'

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import z from "zod";
import CalendarPopover from "../../vehicle/[id]/components/calendar-popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAccountsContext } from "@/contexts/useAccountsContext";
import { collection, doc, increment, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase-client";
import { useAuth } from "@/contexts/auth-context";

const formSchema = z.object({
    date: z.date(),
    description: z.string().min(1, "Description is required"),
    creditingAccount: z.string().min(1, "Crediting Account is required"),
    debitingAccount: z.string().min(1, "Debitng Account is required"),
    amount: z.number().min(0, "Amount must be positive"),
})

type FormOutput = z.infer<typeof formSchema>;

export function AddTransactionDialog() {
    const [open, setOpen] = useState(false);
    const [confirmClose, setConfirmClose] = useState(false);

    const { accounts } = useAccountsContext();
    const { user } = useAuth();

    const form = useForm<FormOutput>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            date: new Date(),
            description: "",
            creditingAccount: "",
            debitingAccount: "",
            amount: 0,
        },
        mode: "onSubmit",
        reValidateMode: "onSubmit",
    })

    async function onSubmit(data: FormOutput) {
        try {
            const batch = writeBatch(db);

            // Transactions
            const transactionId = doc(collection(db, "transactions")).id;

            const creditTransactionRef = doc(
                db, "accounts", data.creditingAccount, "transactions", transactionId
            );

            batch.set(creditTransactionRef, {
                date: data.date,
                amount: data.amount,
                type: "credit",
                description: data.description,
                createdAt: serverTimestamp(),
            })

            const debitTransactionRef = doc(
                db, "accounts", data.debitingAccount, "transactions", transactionId
            );

            batch.set(debitTransactionRef, {
                date: data.date,
                amount: data.amount,
                type: "debit",
                description: data.description,
                createdAt: serverTimestamp(),
            })

            // Accounts
            const creditAccountRef = doc(db, "accounts", data.creditingAccount);
            batch.update(creditAccountRef, {
                balance: increment(data.amount),
            })

            const debitAccountRef = doc(db, "accounts", data.debitingAccount);
            batch.update(debitAccountRef, {
                balance: increment(-data.amount),
            });

            // Audit Log
            const auditLogRef = doc(collection(db, "auditLogs"));
            batch.set(auditLogRef, {
                userId: user?.uid,
                transactionId: transactionId,
                action: "create",
                description: `Transaction added`,
                entityStatus: true,
                createdAt: serverTimestamp(),
            });

            await batch.commit();

            form.reset();
            setOpen(false);
        } catch (err) {
            console.error("Transaction failed:", err);
        }
    }

    function handleCancel() {
        if (form.formState.isDirty) {
            setConfirmClose(true);
        } else {
            form.reset();
            setOpen(false);
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Transaction
                </Button>
            </DialogTrigger>

            <DialogContent className="min-w-2xl">
                <DialogHeader className="pb-4">
                    <DialogTitle>Add a New Transaction</DialogTitle>
                </DialogHeader>
                <form id="add-transaction-form" onSubmit={form.handleSubmit(onSubmit)}>
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
                                            onChange={(e) =>
                                                field.onChange(Number(e.target.value))
                                            }
                                            placeholder="Amount"
                                        />
                                        {fieldState.invalid && <FieldError errors={[fieldState.error]} />}
                                    </Field>
                                )}
                            />

                            <Controller
                                name="debitingAccount"
                                control={form.control}
                                render={({ field, fieldState }) => (
                                    <Field data-invalid={fieldState.invalid}>
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
                    <Button type="submit" form="add-transaction-form">Submit</Button>
                    <Button type="button" variant="outline" onClick={handleCancel}>
                        Cancel
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}