"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  deleteUser,
  GoogleAuthProvider,
  setPersistence,
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { Chrome, Regex } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import z from "zod";
import { BlueprintLorry } from "@/components/shared/blueprint-lorry";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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

const formSchema = z.object({
  email: z.string().min(1, "Email is required").email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
  rememberMe: z.boolean().default(false),
});

type FormOutput = z.infer<typeof formSchema>;

/** Only allow same-origin relative paths (open-redirect safe). */
function resolvePostAuthPath(next: string | null): string {
  if (!next) return "/";
  const trimmed = next.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return "/";
  if (trimmed.startsWith("/sign-in")) return "/";
  return trimmed;
}

export default function SignInPage() {
  return (
    <Suspense fallback={null}>
      <SignInForm />
    </Suspense>
  );
}

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const redirectTo = resolvePostAuthPath(searchParams.get("next"));

  useEffect(() => {
    if (!loading && user) {
      router.replace(redirectTo);
    }
  }, [loading, user, router, redirectTo]);

  const form = useForm({
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false,
    },
    resolver: zodResolver(formSchema),
  });

  async function onSubmit(data: FormOutput) {
    setIsLoading(true);
    try {
      const persistence = data.rememberMe
        ? browserLocalPersistence
        : browserSessionPersistence;
      await setPersistence(auth, persistence);

      await signInWithEmailAndPassword(auth, data.email, data.password);
      router.push(redirectTo);
    } catch (error) {
      console.error("Failed to sign in", error);
      form.setError("root", { message: "Invalid email or password" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setIsLoading(true);

    try {
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);

      const user = result.user;

      // Admin-provisioned users are stored under users/{uid}
      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (!userDoc.exists()) {
        await deleteUser(user);
        await auth.signOut();

        alert("No account found. Contact admin.");
        return;
      }

      router.push(redirectTo);
    } catch (error) {
      console.error("Failed to sign in with Google", error);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,30rem)_1fr]">
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-2 border-b px-6">
          <Regex className="size-6 text-destructive" strokeWidth={1.5} />
          <span className="font-bodoni text-2xl font-light text-foreground/80">
            Stuttgart
          </span>
        </header>

        <main className="flex flex-1 flex-col justify-center gap-8 px-6 py-10 sm:px-10">
          <div className="flex flex-col gap-3">
            <span className="eyebrow">( Sign in · Ledger access )</span>
            <h1 className="heading text-3xl leading-tight">
              <span className="text-muted-foreground">Welcome back.</span> Sign
              in to continue.
            </h1>
          </div>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="flex flex-col gap-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        placeholder="name@company.com"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
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
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center gap-2 space-y-0 text-sm">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                    <FormLabel className="font-normal">
                      Keep me signed in on this device
                    </FormLabel>
                  </FormItem>
                )}
              />
              {form.formState.errors.root && (
                <div className="rounded-md bg-danger-soft px-3 py-2 text-sm font-medium text-destructive">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button
                type="submit"
                className="mt-2 h-10 w-full"
                disabled={isLoading}
              >
                {isLoading ? "Signing in…" : "Sign in"}
              </Button>
            </form>
          </Form>

          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-border" />
            <span className="eyebrow">Or</span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button
            variant="outline"
            type="button"
            className="h-10"
            disabled={isLoading}
            onClick={handleGoogleSignIn}
          >
            <Chrome />
            Continue with Google
          </Button>
        </main>

        <footer className="border-t px-6 py-4">
          <p className="font-mono text-xs text-muted-foreground">
            Accounts are created by your administrator.
          </p>
        </footer>
      </div>

      <aside className="relative hidden flex-col justify-between overflow-hidden border-l bg-card lg:flex">
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -left-10 top-0 h-px w-[160%] origin-top-left rotate-[24deg] bg-border"
        />
        <div className="relative flex h-14 items-center justify-end border-b px-8">
          <span className="eyebrow">( Finance · Fleet · Operations )</span>
        </div>
        <div className="relative flex flex-1 items-center justify-center px-12">
          <BlueprintLorry className="h-auto w-full max-w-2xl" />
        </div>
        <div className="relative border-t px-8 py-8">
          <p className="heading max-w-lg text-4xl leading-tight">
            <span className="text-muted-foreground">Built like a ledger.</span>{" "}
            Runs your fleet.
          </p>
        </div>
      </aside>
    </div>
  );
}
