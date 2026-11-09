"use client";

import { Check, Copy, Link2 } from "lucide-react";
import { useEffect, useState } from "react";
import {
  RuledDialogFooter,
  RuledDialogHeader,
  RuledDialogSection,
  ruledDialogContentClass,
} from "@/components/shared/ruled-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type ShareClientAnalyticsDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientName: string;
};

export default function ShareClientAnalyticsDialog({
  open,
  onOpenChange,
  clientName,
}: ShareClientAnalyticsDialogProps) {
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
      console.error("Failed to copy analytics link:", error);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`${ruledDialogContentClass} sm:max-w-lg`}>
        <RuledDialogHeader
          eyebrow={`( Share · ${clientName} )`}
          lead="Share"
          title="analytics."
          description="Anyone with access to this workspace can open the link."
        />
        <RuledDialogSection label="01 / Link">
          <div className="flex items-center gap-2 sm:col-span-2">
            <div className="relative min-w-0 flex-1">
              <Link2 className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                readOnly
                value={pageUrl}
                aria-label="Analytics link"
                className="pl-8 font-mono text-xs"
                onFocus={(event) => event.currentTarget.select()}
              />
            </div>
            <Button type="button" variant="outline" onClick={handleCopy}>
              {copied ? <Check /> : <Copy />}
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </RuledDialogSection>
        <RuledDialogFooter summary="Read-only view of this client’s figures">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </RuledDialogFooter>
      </DialogContent>
    </Dialog>
  );
}
