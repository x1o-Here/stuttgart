"use client";

import { Check, Copy, Link2, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ShareReportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reportName: string;
};

export default function ShareReportDialog({
  open,
  onOpenChange,
  reportName,
}: ShareReportDialogProps) {
  const [copied, setCopied] = useState(false);
  const [pageUrl, setPageUrl] = useState("");

  useEffect(() => {
    if (!open) {
      setCopied(false);
      return;
    }
    setPageUrl(typeof window !== "undefined" ? window.location.href : "");
  }, [open]);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error("Failed to copy report link:", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="h-4 w-4" />
            Share report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <p className="text-sm text-zinc-500">
            Anyone with this link can open <strong>{reportName}</strong>.
          </p>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Link2 className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <Input readOnly value={pageUrl} className="pl-8" />
            </div>
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? (
                <>
                  <Check className="mr-1.5 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1.5 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
