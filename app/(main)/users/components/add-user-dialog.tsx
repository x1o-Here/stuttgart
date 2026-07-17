"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { type FirebaseApp, getApp, initializeApp } from "firebase/app";
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Check, ChevronsUpDown, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { db } from "@/lib/firebase/firebase-client";
import { cn } from "@/lib/utils";

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  companies: z.array(z.string()).min(1, "Companies are required"),
  role: z.string().min(1, "Role is required"),
});

type FormOutput = z.infer<typeof formSchema>;

type CompanyOption = {
  id: string;
  name: string;
};

function getCompanyName(companyOptions: CompanyOption[], companyId: string) {
  return (
    companyOptions.find((company) => company.id === companyId)?.name ??
    companyId
  );
}

function CompanyMultiSelect({
  value,
  onChange,
  options,
  loading,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  options: CompanyOption[];
  loading?: boolean;
}) {
  const [open, setOpen] = useState(false);

  function toggleCompany(companyId: string) {
    onChange(
      value.includes(companyId)
        ? value.filter((id) => id !== companyId)
        : [...value, companyId],
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={loading}
          className={cn(
            "w-full min-w-72 justify-between font-normal",
            value.length === 0 && "text-muted-foreground",
          )}
        >
          <span className="flex flex-1 flex-wrap gap-1 truncate text-left">
            {loading
              ? "Loading companies..."
              : value.length === 0
                ? "Select companies"
                : value.map((companyId) => (
                    <Badge key={companyId} variant="secondary">
                      {getCompanyName(options, companyId)}
                    </Badge>
                  ))}
          </span>
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="z-[100] w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
      >
        <Command>
          <CommandList>
            <CommandEmpty>No companies found.</CommandEmpty>
            <CommandGroup>
              {options.map((company) => {
                const isSelected = value.includes(company.id);

                return (
                  <CommandItem
                    key={company.id}
                    value={company.name}
                    onSelect={() => toggleCompany(company.id)}
                  >
                    <span className="flex-1">{company.name}</span>
                    {isSelected ? (
                      <Check className="size-4 opacity-60" />
                    ) : null}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function generateRandomPassword() {
  const length = 10;
  const charset =
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let retVal = "";
  for (let i = 0, n = charset.length; i < length; ++i) {
    retVal += charset.charAt(Math.floor(Math.random() * n));
  }
  return retVal;
}

export default function AddUserDialog() {
  const [open, setOpen] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [companyOptions, setCompanyOptions] = useState<CompanyOption[]>([]);
  const [companiesLoading, setCompaniesLoading] = useState(false);
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!open) return;

    async function fetchCompanies() {
      setCompaniesLoading(true);
      try {
        const companySnapshot = await getDocs(collection(db, "companies"));
        setCompanyOptions(
          companySnapshot.docs.map((companyDoc) => ({
            id: (companyDoc.data().id as string) ?? companyDoc.id,
            name: (companyDoc.data().name as string) ?? companyDoc.id,
          })),
        );
      } catch (error) {
        console.error("Failed to fetch companies:", error);
        setCompanyOptions([]);
      } finally {
        setCompaniesLoading(false);
      }
    }

    fetchCompanies();
  }, [open]);

  const form = useForm<FormOutput>({
    defaultValues: {
      username: "",
      email: "",
      companies: [],
      role: "user",
    },
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
  });

  async function onSubmit(data: FormOutput) {
    let userCredential;
    try {
      const firebaseConfig = {
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
        storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
        messagingSenderId:
          process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
        appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      };

      let secondaryApp: FirebaseApp;
      try {
        secondaryApp = getApp("SecondaryClient");
      } catch {
        secondaryApp = initializeApp(firebaseConfig, "SecondaryClient");
      }

      const secondaryAuth = getAuth(secondaryApp);

      const password = generateRandomPassword();
      userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        data.email,
        password,
      );
      const authUser = userCredential.user;

      const batch = writeBatch(db);

      // 1️⃣ Add user to Firestore
      const userRef = doc(db, "users", authUser.uid);
      batch.set(userRef, {
        username: data.username,
        email: data.email,
        role: data.role,
        companies: data.companies,
        firstSignIn: true,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      // 2️⃣ Add Audit Log
      const auditLogRef = doc(collection(db, "auditLogs"));
      batch.set(auditLogRef, {
        userId: currentUser?.uid,
        action: "create",
        description: `User created: ${data.username} (${data.email})`,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });

      await batch.commit();

      const welcomeTemplate = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
          <h2 style="color: #333;">Welcome to Stuttgart</h2>
          <p>Your account has been successfully created. To get started, please set your password using the secure link below:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{resetLink}}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Set My Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">This link will expire for your security. If you didn't expect this invitation, you can safely ignore this email.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Stuttgart App Team</p>
        </div>
      `;

      // 3️⃣ Generate and send a personalized password reset link via custom email
      await axios.post("/api/users/send-reset-link", {
        email: data.email,
        subject: "Welcome to Stuttgart",
        htmlTemplate: welcomeTemplate,
      });

      // 4️⃣ Clean up secondary auth session
      await signOut(secondaryAuth);

      form.reset();
      setOpen(false);
    } catch (error) {
      console.error("Failed to add user or send email", error);

      // Rollback if user was created but process failed
      if (userCredential && userCredential.user) {
        try {
          await deleteDoc(doc(db, "users", userCredential.user.uid));
          await userCredential.user.delete();
          console.log("Rolled back user creation");
        } catch (rollbackError) {
          console.error("Failed to rollback user creation", rollbackError);
        }
      }

      form.setError("root", {
        message: "Failed to create user. Please try again.",
      });
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
            <Plus className="mr-2 h-4 w-4" />
            Add User
          </Button>
        </DialogTrigger>
        <DialogContent className="w-[500px]">
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="pb-4">
              <DialogTitle>Add a New User</DialogTitle>
            </DialogHeader>
            <div className="max-h-lg overflow-y-auto flex flex-col gap-8">
              <div className="flex flex-col gap-4">
                <div className="grid gap-4">
                  <FormField
                    control={form.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-3 gap-x-4">
                        <FormLabel>Username</FormLabel>
                        <FormControl className="col-span-2">
                          <Input
                            type="text"
                            placeholder="johndoe"
                            className="w-full  px-3 py-2 border border-gray-300 rounded-md"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-3 gap-x-4">
                        <FormLabel>Email</FormLabel>
                        <FormControl className="col-span-2">
                          <Input
                            type="email"
                            placeholder="user@example.com"
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
                    name="companies"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-3 gap-x-4">
                        <FormLabel>Companies</FormLabel>
                        <FormControl className="col-span-2">
                          <CompanyMultiSelect
                            value={field.value}
                            onChange={field.onChange}
                            options={companyOptions}
                            loading={companiesLoading}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem className="grid grid-cols-3 gap-x-4">
                        <FormLabel>Role</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl className="col-span-2">
                            <SelectTrigger>
                              <SelectValue placeholder="Select a role" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="user">User</SelectItem>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="manager">Manager</SelectItem>
                          </SelectContent>
                        </Select>
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
