"use client";
import { Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadIntoExtension } from "@/lib/extension-bridge";
import type { ClientRequest } from "@/lib/types";
import type { FormDescriptor } from "@/lib/forms";
import { cn } from "@/lib/utils";

export function LoadFillButton({
  form,
  request,
  size,
  fullWidth,
}: {
  form: FormDescriptor;
  request: ClientRequest;
  size?: "sm";
  fullWidth?: boolean;
}) {
  return (
    <Button
      size={size}
      onClick={() => loadIntoExtension(form, request)}
      className={cn(fullWidth && "w-full justify-center")}
    >
      <Rocket className="h-3.5 w-3.5" />
      Load &amp; Fill in Extension
    </Button>
  );
}
