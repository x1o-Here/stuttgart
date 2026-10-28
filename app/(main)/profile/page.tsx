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
import type * as React from "react";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { CompanyChips } from "@/components/shared/company-chips";
import { LoadingState } from "@/components/shared/loading-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/auth-context";
import { roleLabel } from "@/lib/auth/roles";
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
  const {
    user,
    username,
    role,
    companies,
    activeCompany,
    setActiveCompany,
    refreshProfile,
    loading,
  } = useAuth();
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
      <div className="h-full bg-card p-4 font-sans md:p-6">
        <LoadingState
          message="Loading profile..."
          variant="skeleton"
          rows={4}
        />
      </div>
    );
  }

  const roleText = roleLabel(role);
  const facts = [
    { label: "01 / Username", value: username || "–" },
    {
      label: "02 / Email",
      value: <span className="font-mono">{user?.email || "–"}</span>,
    },
    {
      label: "03 / Role",
      value: (
        <Badge
          variant={
            role === "admin"
              ? "brand"
              : role === "manager"
                ? "warning"
                : "neutral"
          }
        >
          {roleText}
        </Badge>
      ),
    },
    {
      label: "04 / Companies",
      value: <CompanyChips companies={companies} activeId={activeCompany} />,
    },
  ];

  return (
    <div className="flex h-full flex-col divide-y overflow-y-auto bg-card font-sans">
      <PageHeader
        eyebrow={`( Account · ${roleText} )`}
        lead="Your"
        title="profile."
        description={
          canChangePassword
            ? "Signs in with email and password"
            : "Signs in with Google"
        }
      />

      <dl className="grid gap-px bg-border sm:grid-cols-2 xl:grid-cols-4">
        {facts.map((fact) => (
          <div
            key={fact.label}
            className="flex min-w-0 flex-col gap-2 bg-card px-5 py-4"
          >
            <dt className="eyebrow normal-case tracking-normal">
              {fact.label}
            </dt>
            <dd className="min-w-0 text-sm text-foreground">{fact.value}</dd>
          </div>
        ))}
      </dl>

      <ProfileSection
        label="05 / Active company"
        description="Switches which company’s accounts, clients, fleet and reports you’re working in."
      >
        {companies.length === 0 ? (
          <p className="rounded-md border bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground">
            You aren’t assigned to a company yet. Ask an admin to add you to
            one.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Label htmlFor="active-company">Company</Label>
            <Select value={activeCompany} onValueChange={setActiveCompany}>
              <SelectTrigger id="active-company" className="w-full bg-card">
                <SelectValue placeholder="Select a company" />
              </SelectTrigger>
              <SelectContent position="popper" side="bottom">
                {companies.map((company) => (
                  <SelectItem key={company.id} value={company.id}>
                    {company.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {companies.length === 1
                ? "You belong to one company."
                : `You belong to ${companies.length} companies. The switch applies straight away.`}
            </p>
          </div>
        )}
      </ProfileSection>

      <ProfileSection
        label="06 / Username"
        description="This name appears in the sidebar, on audit entries and across the app."
      >
        <Form {...usernameForm}>
          <form
            onSubmit={usernameForm.handleSubmit(onSaveUsername)}
            className="flex flex-col gap-4"
          >
            <FormField
              control={usernameForm.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Your username"
                      autoComplete="username"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <StatusNote error={usernameError} message={usernameMessage} />
            <div>
              <Button type="submit" disabled={savingUsername}>
                {savingUsername ? "Saving…" : "Save username"}
              </Button>
            </div>
          </form>
        </Form>
      </ProfileSection>

      <ProfileSection
        label="07 / Password"
        description="Confirm your current password, then choose a new one of at least 6 characters."
      >
        {!canChangePassword ? (
          <p className="rounded-md border bg-surface-muted px-3 py-2.5 text-sm text-muted-foreground">
            Your account signs in with Google, so there’s no password to change
            here.
          </p>
        ) : (
          <Form {...passwordForm}>
            <form
              onSubmit={passwordForm.handleSubmit(onChangePassword)}
              className="flex flex-col gap-4"
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
              <div className="grid gap-4 sm:grid-cols-2">
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
              </div>
              <StatusNote error={passwordError} message={passwordMessage} />
              <div>
                <Button type="submit" disabled={savingPassword}>
                  {savingPassword ? "Updating…" : "Update password"}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </ProfileSection>
    </div>
  );
}

/** Ruled settings row: caption + description on the left, form on the right. */
function ProfileSection({
  label,
  description,
  children,
}: {
  label: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-4 px-4 py-6 md:grid-cols-[18rem_minmax(0,32rem)] md:gap-10 md:px-6">
      <div className="flex flex-col gap-1">
        <h2 className="eyebrow normal-case tracking-normal">{label}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function StatusNote({
  error,
  message,
}: {
  error: string | null;
  message: string | null;
}) {
  if (error) {
    return (
      <p
        role="alert"
        className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive"
      >
        {error}
      </p>
    );
  }
  if (message) {
    return (
      <output className="block rounded-md bg-success-soft px-3 py-2 text-sm text-success">
        {message}
      </output>
    );
  }
  return null;
}
