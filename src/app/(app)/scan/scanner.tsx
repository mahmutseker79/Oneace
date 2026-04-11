"use client";

import { AlertTriangle, Camera, CameraOff, Check, Loader2, Package, Search, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { type ScanLookupResult, lookupItemByCodeAction } from "./actions";

// Feature-detect BarcodeDetector. It's a Web API with wide support on
// Chrome/Edge/Android but missing on Safari and Firefox; we fall back to
// manual entry in those browsers.
type BarcodeDetectorLike = {
  detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>>;
};

type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

const SUPPORTED_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "qr_code",
  "itf",
];

export type ScannerLabels = {
  cameraHeading: string;
  cameraSubtitle: string;
  startCamera: string;
  stopCamera: string;
  cameraUnsupported: string;
  cameraUnsupportedBody: string;
  cameraDenied: string;
  cameraDeniedBody: string;
  cameraError: string;
  scanningStatus: string;
  manualHeading: string;
  manualSubtitle: string;
  manualLabel: string;
  manualPlaceholder: string;
  manualSubmit: string;
  resultHeadingFound: string;
  resultHeadingNotFound: string;
  resultNotFoundBody: string;
  resultClear: string;
  resultViewItem: string;
  resultNewItem: string;
  resultSku: string;
  resultBarcode: string;
  resultOnHand: string;
  resultReserved: string;
  resultReorderPoint: string;
  resultStatus: string;
  resultLevelsHeading: string;
  resultNoLevels: string;
  columnWarehouse: string;
  columnQuantity: string;
  columnReserved: string;
  status: { ACTIVE: string; ARCHIVED: string; DRAFT: string };
  lookingUp: string;
  lookupError: string;
};

type ScannerProps = {
  labels: ScannerLabels;
  initialQuery?: string;
};

type CameraState = "idle" | "starting" | "running" | "stopped" | "unsupported" | "denied" | "error";

export function Scanner({ labels, initialQuery }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<string | null>(null);
  const lastTickRef = useRef<number>(0);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [manualValue, setManualValue] = useState(initialQuery ?? "");
  const [result, setResult] = useState<ScanLookupResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lookupError, setLookupError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) track.stop();
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraState((prev) => (prev === "starting" || prev === "running" ? "stopped" : prev));
  }, []);

  const handleLookup = useCallback(
    (code: string) => {
      setLookupError(null);
      setResult(null);
      startTransition(async () => {
        const res = await lookupItemByCodeAction(code);
        if (!res.ok) {
          setLookupError(res.error || labels.lookupError);
          return;
        }
        setResult(res);
      });
    },
    [labels.lookupError],
  );

  const tick = useCallback(() => {
    if (!detectorRef.current || !videoRef.current) return;
    const now = performance.now();
    // Throttle detection to ~6 FPS — enough for real-world scanning without
    // burning battery or starving React.
    if (now - lastTickRef.current < 160) {
      rafRef.current = requestAnimationFrame(tick);
      return;
    }
    lastTickRef.current = now;
    detectorRef.current
      .detect(videoRef.current)
      .then((codes) => {
        if (codes.length > 0) {
          const first = codes[0];
          if (first) {
            const value = first.rawValue.trim();
            if (value && value !== lastCodeRef.current) {
              lastCodeRef.current = value;
              setManualValue(value);
              handleLookup(value);
              stopCamera();
              return;
            }
          }
        }
        rafRef.current = requestAnimationFrame(tick);
      })
      .catch(() => {
        rafRef.current = requestAnimationFrame(tick);
      });
  }, [handleLookup, stopCamera]);

  const startCamera = useCallback(async () => {
    setLookupError(null);
    const globalObj = globalThis as unknown as { BarcodeDetector?: BarcodeDetectorCtor };
    const Ctor = globalObj.BarcodeDetector;
    if (!Ctor) {
      setCameraState("unsupported");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      return;
    }

    setCameraState("starting");
    try {
      detectorRef.current = new Ctor({ formats: SUPPORTED_FORMATS });
    } catch {
      // Some browsers advertise BarcodeDetector but reject the formats list.
      try {
        detectorRef.current = new Ctor();
      } catch {
        setCameraState("unsupported");
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      lastCodeRef.current = null;
      setCameraState("running");
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraState("denied");
      } else {
        setCameraState("error");
      }
    }
  }, [tick]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect — handleLookup/stopCamera are stable useCallbacks, initialQuery should not retrigger
  useEffect(() => {
    // If the parent gives us an initialQuery (e.g. deep link from item detail),
    // kick off a lookup immediately without requiring camera access.
    if (initialQuery && initialQuery.trim().length > 0) {
      handleLookup(initialQuery.trim());
    }
    return () => {
      stopCamera();
    };
  }, []);

  function handleManualSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = manualValue.trim();
    if (!value) return;
    handleLookup(value);
  }

  function handleClear() {
    setResult(null);
    setLookupError(null);
    setManualValue("");
    lastCodeRef.current = null;
  }

  const isCameraRunning = cameraState === "running" || cameraState === "starting";

  return (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              {labels.cameraHeading}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{labels.cameraSubtitle}</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="relative overflow-hidden rounded-lg border border-border bg-black aspect-video">
              <video
                ref={videoRef}
                className="h-full w-full object-cover"
                muted
                playsInline
                autoPlay
              />
              {cameraState === "running" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="h-[55%] w-[70%] rounded-md border-2 border-emerald-400/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
                </div>
              ) : null}
              {cameraState !== "running" ? (
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-white/80">
                  <CameraOff className="h-10 w-10" />
                </div>
              ) : null}
            </div>

            {cameraState === "running" ? (
              <p className="flex items-center gap-2 text-xs text-emerald-600">
                <Loader2 className="h-3 w-3 animate-spin" />
                {labels.scanningStatus}
              </p>
            ) : null}

            <div className="flex gap-2">
              {isCameraRunning ? (
                <Button type="button" variant="outline" onClick={stopCamera}>
                  <CameraOff className="h-4 w-4" />
                  {labels.stopCamera}
                </Button>
              ) : (
                <Button type="button" onClick={startCamera}>
                  <Camera className="h-4 w-4" />
                  {labels.startCamera}
                </Button>
              )}
            </div>

            {cameraState === "unsupported" ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{labels.cameraUnsupported}</AlertTitle>
                <AlertDescription>{labels.cameraUnsupportedBody}</AlertDescription>
              </Alert>
            ) : null}
            {cameraState === "denied" ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{labels.cameraDenied}</AlertTitle>
                <AlertDescription>{labels.cameraDeniedBody}</AlertDescription>
              </Alert>
            ) : null}
            {cameraState === "error" ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{labels.cameraError}</AlertTitle>
              </Alert>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              {labels.manualHeading}
            </CardTitle>
            <p className="text-sm text-muted-foreground">{labels.manualSubtitle}</p>
          </CardHeader>
          <CardContent>
            <form className="flex gap-2" onSubmit={handleManualSubmit}>
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="scan-manual" className="sr-only">
                  {labels.manualLabel}
                </Label>
                <Input
                  id="scan-manual"
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={labels.manualPlaceholder}
                  disabled={isPending}
                  autoComplete="off"
                />
              </div>
              <Button type="submit" disabled={isPending || manualValue.trim() === ""}>
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {labels.manualSubmit}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        {isPending ? (
          <Card>
            <CardContent className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {labels.lookingUp}
            </CardContent>
          </Card>
        ) : null}

        {lookupError ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{lookupError}</AlertDescription>
          </Alert>
        ) : null}

        {result?.ok && result.found ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Check className="h-5 w-5 text-emerald-500" />
                  <CardTitle>{labels.resultHeadingFound}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-xl font-semibold">{result.item.name}</p>
                <p className="font-mono text-xs text-muted-foreground">
                  {labels.resultSku}: {result.item.sku}
                  {result.item.barcode ? (
                    <>
                      <span className="mx-1">·</span>
                      {labels.resultBarcode}: {result.item.barcode}
                    </>
                  ) : null}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">{labels.resultOnHand}</p>
                  <p className="font-mono text-2xl font-semibold">{result.item.totalOnHand}</p>
                  <p className="text-xs text-muted-foreground">
                    {labels.resultReserved}: {result.item.totalReserved}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{labels.resultReorderPoint}</p>
                  <p className="font-mono text-2xl font-semibold">{result.item.reorderPoint}</p>
                  <p className="text-xs text-muted-foreground">
                    {labels.resultStatus}:{" "}
                    <Badge variant="outline">
                      {labels.status[result.item.status as keyof typeof labels.status] ??
                        result.item.status}
                    </Badge>
                  </p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {labels.resultLevelsHeading}
                </p>
                {result.item.levels.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{labels.resultNoLevels}</p>
                ) : (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {result.item.levels.map((lvl) => (
                      <li
                        key={lvl.warehouseId}
                        className="flex items-center justify-between px-3 py-2 text-sm"
                      >
                        <span>
                          {lvl.warehouseName}
                          <span className="ml-1 font-mono text-xs text-muted-foreground">
                            · {lvl.warehouseCode}
                          </span>
                        </span>
                        <span className="font-mono">{lvl.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Button asChild>
                  <Link href={`/items/${result.item.id}`}>
                    <Package className="h-4 w-4" />
                    {labels.resultViewItem}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}

        {result?.ok && !result.found ? (
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <CardTitle>{labels.resultHeadingNotFound}</CardTitle>
                </div>
                <Button variant="ghost" size="sm" onClick={handleClear}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">{labels.resultNotFoundBody}</p>
              <p className="font-mono text-sm">{result.query}</p>
              <div className="flex gap-2">
                <Button asChild>
                  <Link href={`/items/new?barcode=${encodeURIComponent(result.query)}`}>
                    <Package className="h-4 w-4" />
                    {labels.resultNewItem}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
