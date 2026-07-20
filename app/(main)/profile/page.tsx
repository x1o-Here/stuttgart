"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from "firebase/auth";
import {
  collection,
  doc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { auth, db } from "@/lib/firebase/firebase-client";

const usernameSchema = z.object({
  username: z.string().min(1, "Username is required").max(80, "Too long"),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z
      .string()
      .min(6, "New password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Confirm your new password"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"],
  });

type UsernameForm = z.infer<typeof usernameSchema>;
type PasswordForm = z.infer<typeof passwordSchema>;

export default function ProfilePage() {
  const router = useRouter();
  const { user, username, role, refreshProfile, loading } = useAuth();
  const [usernameMessage, setUsernameMessage] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | null>(null);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [savingUsername, setSavingUsername] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const canChangePassword = useMemo(() => {
    if (!user) return false;
    return user.providerData.some(
      (provider) => provider.providerId === "password",
    );
  }, [user]);

  const usernameForm = useForm<UsernameForm>({
    defaultValues: { username: username || "" },
    resolver: zodResolver(usernameSchema),
  });

  const passwordForm = useForm<PasswordForm>({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
    resolver: zodResolver(passwordSchema),
  });

  useEffect(() => {
    usernameForm.reset({ username: username || "" });
  }, [username, usernameForm]);

  async function onSaveUsername(data: UsernameForm) {
    if (!user) return;
    const nextUsername = data.username.trim();
    if (!nextUsername) return;
    if (nextUsername === (username || "")) {
      setUsernameMessage("No changes to save.");
      setUsernameError(null);
      return;
    }

    setSavingUsername(true);
    setUsernameMessage(null);
    setUsernameError(null);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, "users", user.uid), {
        username: nextUsername,
        updatedAt: serverTimestamp(),
      });
      batch.set(doc(collection(db, "auditLogs")), {
        userId: user.uid,
        action: "update",
        description: `Username changed to ${nextUsername}`,
        entityStatus: true,
        createdAt: serverTimestamp(),
      });
      await batch.commit();
      await refreshProfile();
      setUsernameMessage("Username updated.");
    } catch (error) {
      console.error("Failed to update username", error);
      setUsernameError("Failed to update username. Please try again.");
    } finally {
      setSavingUsername(false);
    }
  }

  async function onChangePassword(data: PasswordForm) {
    const currentUser = auth.currentUser;
    if (!currentUser?.email) {
      setPasswordError("No signed-in account found.");
      return;
    }

    setSavingPassword(true);
    setPasswordMessage(null);
    setPasswordError(null);

    try {
      const credential = EmailAuthProvider.credential(
        currentUser.email,
        data.currentPassword,
      );
      await reauthenticateWithCredential(currentUser, credential);
      await updatePassword(currentUser, data.newPassword);

      const batch = writeBatch(db);
      batch.set(doc(collection(db, "auditLogs")), {
        userId: currentUser.uid,
        action: "update",
        description: "Password changed",
        entityStatus: true,
        createdAt: serverTimestamp(),
      });
      await batch.commit();

      passwordForm.reset();
      setPasswordMessage("Password updated.");
    } catch (error: unknown) {
      console.error("Failed to change password", error);
      const code =
        typeof error === "object" && error && "code" in error
          ? String((error as { code?: string }).code)
          : "";
      if (
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        setPasswordError("Current password is incorrect.");
        passwordForm.setError("currentPassword", {
          message: "Current password is incorrect.",
        });
      } else if (code === "auth/too-many-requests") {
        setPasswordError("Too many attempts. Try again later.");
      } else if (code === "auth/weak-password") {
        setPasswordError("New password is too weak.");
      } else {
        setPasswordError("Failed to change password. Please try again.");
      }
    } finally {
      setSavingPassword(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen h-full p-4 font-sans">
        <div className="h-full rounded-lg bg-zinc-100 p-4">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen h-full p-4 font-sans">
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 overflow-y-auto rounded-lg bg-zinc-100 p-4">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="w-fit px-1"
            onClick={() => router.back()}
          >
            <ChevronLeft />
            Back
          </Button>
        </div>

        <div className="rounded-lg bg-white p-6">
          <h1 className="text-2xl font-bold">Profile</h1>
          <p className="mt-1 text-sm text-muted-foreground capitalize">
            {role || "User"}
            {user?.email ? ` · ${user.email}` : ""}
          </p>
        </div>

        <div className="rounded-lg bg-white p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Username</h2>
            <p className="text-sm text-muted-foreground">
              This name appears in the sidebar and across the app.
            </p>
          </div>

          <Form {...usernameForm}>
            <form
              onSubmit={usernameForm.handleSubmit(onSaveUsername)}
              className="space-y-4"
            >
              <FormField
                control={usernameForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input placeholder="Your username" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {usernameError ? (
                <p className="text-sm text-destructive">{usernameError}</p>
              ) : null}
              {usernameMessage ? (
                <p className="text-sm text-emerald-600">{usernameMessage}</p>
              ) : null}
              <Button type="submit" disabled={savingUsername}>
                {savingUsername ? "Saving..." : "Save username"}
              </Button>
            </form>
          </Form>
        </div>

        <div className="rounded-lg bg-white p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold">Change password</h2>
            <p className="text-sm text-muted-foreground">
              Confirm your current password, then set a new one.
            </p>
          </div>

          {!canChangePassword ? (
            <p className="text-sm text-muted-foreground">
              Password change is only available for accounts that sign in with
              email and password.
            </p>
          ) : (
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(onChangePassword)}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm new password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {passwordError ? (
                  <p className="text-sm text-destructive">{passwordError}</p>
                ) : null}
                {passwordMessage ? (
                  <p className="text-sm text-emerald-600">{passwordMessage}</p>
                ) : null}
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? "Updating..." : "Update password"}
                </Button>
              </form>
            </Form>
          )}
        </div>
      </div>
    </div>
  );
}
