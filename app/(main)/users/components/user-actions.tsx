"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { MoreHorizontal, KeyRound } from "lucide-react";
import axios from "axios";
import { UserData } from "./columns";

interface UserActionsProps {
  user: UserData;
}

export function UserActions({ user }: UserActionsProps) {
  const [loading, setLoading] = useState(false);

  async function handleResetPassword() {
    if (!window.confirm(`Reset password for ${user.email}?`)) {
      return;
    }

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
        htmlTemplate: resetTemplate
      });
      alert("Password reset email sent successfully!");
    } catch (error: any) {
      console.error("Error sending reset email:", error);
      alert(`Error: ${error.response?.data?.error || error.message}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={handleResetPassword}
          disabled={loading}
          className="cursor-pointer"
        >
          <KeyRound className="mr-2 h-4 w-4 text-zinc-500" />
          Reset Password
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
