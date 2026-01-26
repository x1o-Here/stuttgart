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
  purchasedDate: z
    .date()
    .min(new Date("1900-01-01"), "Purchased Date must be after Jan 1, 1900"),
  purchasedAmount: z.number().min(0, "Amount must be positive"),
  sellerName: z.string().min(1, "Seller Name is required"),
  sellerContact: z.string().min(1, "Seller Contact is required"),
  legalOwner: z.string().min(1, "Legal Owner is required"),
  isCR: z.boolean(),
});

type FormOutput = z.infer<typeof formSchema>;

export default function EditPurchaseDialog({
  id,
  data,
}: {
  id: string;
  data: any;
}) {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);

  const { user } = useAuth();

  const form = useForm<FormOutput>({
    defaultValues: {
      purchasedDate: toDate(data?.purchasedDate),
      purchasedAmount: data?.purchasedAmount,
      sellerName: data?.sellerName,
      sellerContact: data?.sellerContact,
      legalOwner: data?.legalOwner,
      isCR: data?.isCR,
    },
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(formData: FormOutput) {
    try {
      const batch = writeBatch(db);
      const purchaseRef = doc(db, "purchaseDetails", id);

      batch.update(purchaseRef, {
        purchasedDate: formData.purchasedDate,
        purchasedAmount: formData.purchasedAmount,
        sellerName: formData.sellerName,
        sellerContact: formData.sellerContact,
        legalOwner: formData.legalOwner,
        isCR: formData.isCR,
        updatedAt: serverTimestamp(),
      });

      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: user?.uid,
        vehicleId: id,
        action: "update",
        description: "Purchase details updated",
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      form.reset(formData);
      setOpen(false);
    } catch (error) {
      console.error("Failed to update purchase information", error);
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
          <Button>
            <Edit className="mr-2 h-4 w-4" />
            Edit Purchase Details
          </Button>
        </DialogTrigger>
        <DialogContent className="min-w-6xl">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="pb-4">
              <DialogTitle>Edit Purchase Details</DialogTitle>
            </DialogHeader>
            <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="purchasedDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Purchased Date</FormLabel>
                        <FormControl>
                          <CalendarPopover
                            value={field.value}
                            onChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="purchasedAmount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Amount</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="Amount"
                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sellerName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seller Name</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Seller Name"
                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="sellerContact"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seller Contact</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Seller Contact"
                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="legalOwner"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Legal Owner</FormLabel>
                        <FormControl>
                          <Input
                            type="text"
                            placeholder="Legal Owner"
                            className="w-full text-black px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="isCR"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Is CR</FormLabel>
                        <FormControl>
                          <Select
                            value={field.value ? "true" : "false"}
                            onValueChange={(value) =>
                              field.onChange(value === "true")
                            }
                          >
                            <SelectTrigger className="w-full text-black px-3 py-2 border border-gray-300 rounded-md">
                              <SelectValue placeholder="Select an option" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="true">Yes</SelectItem>
                              <SelectItem value="false">No</SelectItem>
                            </SelectContent>
                          </Select>
                        </FormControl>
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
