"use client";

import { Package } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";

interface ReceiveTransferButtonProps {
  transferId: string;
}

export function ReceiveTransferButton({ transferId }: ReceiveTransferButtonProps) {
  return (
    <Button asChild variant="default">
      <Link href={`/transfers/${transferId}/receive`}>
        <Package className="mr-2 h-4 w-4" />
        Receive Transfer
      </Link>
    </Button>
  );
}
