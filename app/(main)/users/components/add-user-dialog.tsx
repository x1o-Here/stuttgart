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
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { Plus } from "lucide-react";
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

const formSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  role: z.string().min(1, "Role is required"),
});

type FormOutput = z.infer<typeof formSchema>;

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
  const { user: currentUser } = useAuth();

  const form = useForm<FormOutput>({
    defaultValues: {
      username: "",
      email: "",
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
      } catch (e) {
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
        htmlTemplate: welcomeTemplate
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
