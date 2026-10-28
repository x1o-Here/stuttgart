"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { useLookupStore } from "@/stores/use-lookup-store";

const formSchema = z.object({
  name: z.string().min(1, "Name is required"),
  accountType: z.string().min(1, "Account type is required"),
  balance: z.number().min(0, "Balance cannot be negative"),
});

type FormOutput = z.infer<typeof formSchema>;

export default function AddAccountDialog() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();
  const { user, activeCompany } = useAuth();

  const accountTypes = useLookupStore((state) => state.accountTypes);

  const form = useForm<FormOutput>({
    defaultValues: {
      name: "",
      accountType: "",
      balance: 0,
    },
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(data: FormOutput) {
    try {
      setIsSubmitting(true);
      const batch = writeBatch(db);

      // 1️⃣ Add account
      const accountRef = doc(
        collection(db, "companies", activeCompany, "accounts"),
      );
      batch.set(accountRef, {
        name: data.name,
        initialBalance: data.balance,
        accountType: data.accountType,
        balance: data.balance,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      // 2️⃣ Add Audit Log
      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user?.uid,
        action: "create",
        description: `Account created: ${data.name}`,
        companyId: activeCompany,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to add account", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleCancel() {
    if (isSubmitting) return;
    if (form.formState.isDirty) {
      setConfirmClose(true);
    } else {
      form.reset();
      setOpen(false);
    }
  }

  const [watchedName, watchedBalance] = form.watch(["name", "balance"]);
  const summary = watchedName?.trim()
    ? `Opens “${watchedName.trim()}” at ${new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "LKR",
      }).format(watchedBalance || 0)}`
    : "Name the account to continue";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) {
          setOpen(true);
          return;
        }
        handleCancel();
      }}
    >
      <Form {...form}>
        <DialogTrigger asChild>
          <Button>
            <Plus />
            New account
          </Button>
        </DialogTrigger>
        <DialogContent className={ruledDialogContentClass}>
          <RuledDialogHeader
            eyebrow="( New account · Chart of accounts )"
            lead="Open a"
            title="new account."
            description="Accounts hold balances that transactions move money between."
          />
          <form id="add-account-form" onSubmit={form.handleSubmit(onSubmit)}>
            <RuledDialogSection label="01 / Identity">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Account name</FormLabel>
                    <FormControl>
                      <Input
                        type="text"
                        placeholder="e.g. Cash in hand, BOC current account"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="accountType"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Account type</FormLabel>
                    <Select
                      onValueChange={(value) => {
                        if (value === "__new__") {
                          router.push("/settings/account-types");
                          return;
                        }

                        field.onChange(value);
                      }}
                      defaultValue={field.value}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select an account type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent position="popper" side="bottom">
                        {accountTypes.map((accountType) => (
                          <SelectItem
                            key={accountType.id}
                            value={accountType.name}
                          >
                            {accountType.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__new__">
                          <Plus />
                          Create new account type
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </RuledDialogSection>

            <RuledDialogSection label="02 / Opening balance">
              <FormField
                control={form.control}
                name="balance"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Initial balance</FormLabel>
                    <div className="relative">
                      <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center font-mono text-xs text-muted-foreground">
                        LKR
                      </span>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.01"
                          placeholder="0.00"
                          className="h-12 pl-12 font-mono text-2xl font-light tabular-nums md:text-2xl"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) =>
                            field.onChange(parseFloat(e.target.value) || 0)
                          }
                        />
                      </FormControl>
                    </div>
                    <p className="font-mono text-xs text-muted-foreground">
                      The balance carried in before tracking starts here.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </RuledDialogSection>
          </form>
          <RuledDialogFooter summary={summary}>
            <Button
              type="button"
              variant="ghost"
              onClick={handleCancel}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="add-account-form"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Creating…" : "Create account"}
            </Button>
          </RuledDialogFooter>
        </DialogContent>

        <ConfirmationDialog
          open={confirmClose}
          onOpenChange={setConfirmClose}
          onConfirm={() => {
            form.reset();
            setConfirmClose(false);
            setOpen(false);
          }}
        />
      </Form>
    </Dialog>
  );
}
