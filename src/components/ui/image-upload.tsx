"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trackEvent } from "@/lib/analytics/events";

type ImageUploadProps = {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

export function ImageUpload({ value, onChange, disabled = false }: ImageUploadProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (disabled || isLoading) return;

      // Client-side validation
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        toast.error("Only JPEG, PNG, and WebP images are allowed");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB");
        return;
      }

      setIsLoading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload/image", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          toast.error(data.error || "Failed to upload image");
          setIsLoading(false);
          return;
        }

        const { url } = await response.json();
        onChange(url);
        toast.success("Image uploaded successfully");

        // Track image upload event
        trackEvent("item_image_uploaded");
      } catch (err) {
        console.error("Upload error:", err);
        toast.error("An error occurred during upload");
      } finally {
        setIsLoading(false);
      }
    },
    [disabled, isLoading, onChange]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFile(files[0]);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (files && files.length > 0) {
      handleFile(files[0]);
    }
  };

  return (
    <div className="space-y-3">
      {value ? (
        <div className="relative inline-block">
          <div className="relative h-40 w-40 overflow-hidden rounded-lg border border-border">
            <Image
              src={value}
              alt="Item image"
              fill
              className="object-cover"
              sizes="160px"
            />
          </div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => onChange(null)}
            disabled={disabled || isLoading}
            className="absolute -right-2 -top-2"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <label
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-border px-6 py-10 text-center cursor-pointer transition-colors ${
            isLoading ? "opacity-50" : "hover:border-primary"
          } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-2 text-sm font-medium text-foreground">
            Drop image here or click to upload
          </p>
          <p className="text-xs text-muted-foreground">
            JPEG, PNG, or WebP up to 5MB
          </p>
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleInputChange}
            disabled={disabled || isLoading}
            className="hidden"
          />
        </label>
      )}

      {isLoading && (
        <div className="text-sm text-muted-foreground">Uploading...</div>
      )}
    </div>
  );
}
