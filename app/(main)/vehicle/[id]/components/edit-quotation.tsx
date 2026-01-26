"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Edit } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { toDate } from "@/lib/helpers/to-date";
import CalendarPopover from "./calendar-popover";

const formSchema = z.object({
  startDate: z
    .date()
    .min(new Date("1900-01-01"), "Date must be after Jan 1, 1900"),
  endDate: z
    .date()
    .min(new Date("1900-01-01"), "Date must be after Jan 1, 1900"),
  description: z.string().min(1, "Description is required"),
  amount: z.number().min(0, "Amount cannot be negative"),
  vendor: z.string().min(1, "Vendor is required"),
  status: z.string().min(1, "Status is required"),
});

type FormOutput = z.infer<typeof formSchema>;

const statusOptions = [
  { value: "pending", label: "Pending" },
  { value: "in-maintainance", label: "In Maintenance" },
  { value: "completed", label: "Completed" },
  { value: "rejected", label: "Rejected" },
];

export default function EditMaintenanceDialog({
  id,
  data,
}: {
  id: string;
  data?: any;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const { user } = useAuth();

  const form = useForm<FormOutput>({
    defaultValues: {
      startDate: toDate(data?.startDate),
      endDate: toDate(data?.endDate),
      description: data?.description,
      amount: data?.amount,
      vendor: data?.vendor,
      status: data?.status,
    },
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(formData: FormOutput) {
    if (!id) return;

    try {
      const batch = writeBatch(db);
      const quotationRef = doc(db, "quotations", id);

      batch.update(quotationRef, {
        startDate: formData.startDate,
        endDate: formData.endDate,
        description: formData.description,
        amount: formData.amount,
        vendor: formData.vendor,
        status: formData.status,
        updatedAt: serverTimestamp(),
      });

      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user?.uid,
        vehicleId: data?.vehicleId || "",
        action: "update",
        description: "Quotation updated",
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      form.reset(formData);
      setOpen(false);
    } catch (error) {
      console.error("Failed to update quotation:", error);
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
      <Form {...form}>
        <DialogTrigger asChild>
          <Button variant="outline" size="icon-sm">
            <Edit />
          </Button>
        </DialogTrigger>
        <DialogContent className="min-w-4xl">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="pb-4">
              <DialogTitle>Edit Quotation Details</DialogTitle>
            </DialogHeader>
            <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="startDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Start Date</FormLabel>
                        <FormControl>
                          <CalendarPopover
                            value={field.value}
                            onChange={(date) => {
                              if (date) field.onChange(date);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="endDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>End Date</FormLabel>
                        <FormControl>
                          <CalendarPopover
                            value={field.value}
                            onChange={(date) => {
                              if (date) field.onChange(date);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Oil Change, Tire Rotation, etc."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Amount"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                            onChange={(e) =>
                              field.onChange(Number(e.target.value))
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="vendor"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Vendor</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="ABC Auto Shop"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value || ""}
                            onValueChange={(value) => field.onChange(value)}
                          >
                            <SelectTrigger className="w-full px-3 py-2 border border-gray-300 rounded-md">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((option) => (
                                <SelectItem
                                  key={option.value}
                                  value={option.value}
                                >
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="submit">Submit</Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </form>
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
