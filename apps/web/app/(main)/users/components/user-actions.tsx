"use client";

import axios from "axios";
import { KeyRound, MoreHorizontal, UserX } from "lucide-react";
import { useState } from "react";
import ConfirmationDialog from "@/components/custom/confirmation-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/auth-context";
import type { UserData } from "./columns";

interface UserActionsProps {
  user: UserData;
  /** Called after the user is removed so the list can reload. */
  onChanged?: () => void;
}

export function UserActions({ user, onChanged }: UserActionsProps) {
  const { user: currentUser, role: currentRole } = useAuth();
  // Mirrors the checks in /api/users/remove.
  const canRemove =
    currentUser?.uid !== user.id &&
    (user.role !== "admin" || currentRole === "admin");
  const [removeOpen, setRemoveOpen] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  async function handleRemove() {
    setRemoveError(null);
    setRemoving(true);
    try {
      const token = await currentUser?.getIdToken();
      await axios.post(
        "/api/users/remove",
        { uid: user.id },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setRemoveOpen(false);
      onChanged?.();
    } catch (error) {
      console.error("Error removing user:", error);
      setRemoveError(
        axios.isAxiosError(error)
          ? (error.response?.data?.error ?? error.message)
          : "Something went wrong.",
      );
    } finally {
      setRemoving(false);
    }
  }
  const [loading, setLoading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [result, setResult] = useState<
    { ok: true } | { ok: false; message: string } | null
  >(null);

  async function handleResetPassword() {
    setResult(null);
    setLoading(true);
    try {
      const resetTemplate = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e1e1e1; border-radius: 8px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>We received a request to reset your password for Stuttgart App. You can set a new password by clicking the button below:</p>
          <div style="margin: 30px 0; text-align: center;">
            <a href="{{resetLink}}" style="background-color: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold; display: inline-block;">Reset Password</a>
          </div>
          <p style="color: #666; font-size: 14px;">If you did not request a password reset, you can safely ignore this email. This link will expire shortly for your security.</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">Stuttgart App Team</p>
        </div>
      `;

      await axios.post("/api/users/send-reset-link", {
        email: user.email,
        subject: "Password Reset Request",
        htmlTemplate: resetTemplate,
      });
      setResult({ ok: true });
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      setResult({
        ok: false,
        message: error.response?.data?.error || error.message,
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={`Actions for ${user.username}`}
          >
            <MoreHorizontal />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setResult(null);
              setConfirmOpen(true);
            }}
          >
            <KeyRound />
            Send password reset
          </DropdownMenuItem>
          {canRemove ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onClick={() => {
                  setRemoveError(null);
                  setRemoveOpen(true);
                }}
              >
                <UserX />
                Remove user
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={(next) => {
          if (!loading) setConfirmOpen(next);
        }}
        eyebrow={`( Access · ${user.username} )`}
        lead="Send a"
        title="password reset?"
        description={`A reset link is emailed to ${user.email}. Their current password keeps working until they set a new one.`}
        confirmLabel={
          loading ? "Sending…" : result?.ok ? "Done" : "Send reset link"
        }
        cancelLabel={result?.ok ? "Close" : "Cancel"}
        destructive={false}
        pending={loading}
        keepOpen
        onConfirm={() => {
          if (result?.ok) {
            setConfirmOpen(false);
            return;
          }
          void handleResetPassword();
        }}
      >
        {result ? (
          result.ok ? (
            <p className="rounded-md bg-success-soft px-3 py-2 text-sm text-success">
              Reset link sent to {user.email}.
            </p>
          ) : (
            <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
              Couldn’t send the email: {result.message}
            </p>
          )
        ) : null}
      </ConfirmationDialog>

      <ConfirmationDialog
        open={removeOpen}
        onOpenChange={(next) => {
          if (!removing) setRemoveOpen(next);
        }}
        eyebrow={`( Access · ${user.username} )`}
        lead="Remove"
        title={`${user.username}?`}
        description={`They can no longer sign in, and ${user.email} is freed so a new account can use it. Their audit log history is kept.`}
        confirmLabel={removing ? "Removing…" : "Remove user"}
        pending={removing}
        keepOpen
        onConfirm={() => void handleRemove()}
      >
        {removeError ? (
          <p className="rounded-md bg-danger-soft px-3 py-2 text-sm text-destructive">
            Couldn’t remove the user: {removeError}
          </p>
        ) : null}
      </ConfirmationDialog>
    </>
  );
}
