"use client";

import {
  AlertTriangle,
  ArrowLeftRight,
  Camera,
  CameraOff,
  Check,
  Clock,
  Loader2,
  Maximize,
  Minimize,
  Package,
  Plus,
  Search,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";

import { type QuickAddLabels, QuickAddSheet } from "@/components/scanner/quick-add-sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type BarcodeDetectorLike,
  type DetectorEngine,
  createDetector,
} from "@/lib/scanner/detector";
import { isMuted, scanError, scanSuccess, setMuted } from "@/lib/scanner/feedback";
import {
  type ScanHistoryEntry,
  addScanEntry,
  clearScanHistory,
  getScanHistory,
} from "@/lib/scanner/scan-history";

import { type ScanLookupResult, lookupItemByCodeAction } from "./actions";

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
  engineNative: string;
  engineZxing: string;
  engineLoading: string;
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
  resultRecordMovement: string;
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
  // P9.1 additions
  continuousMode: string;
  scanCount: string;
  mute: string;
  unmute: string;
  history: string;
  clearHistory: string;
  noHistory: string;
  fullscreen: string;
  exitFullscreen: string;
  quickAdd: QuickAddLabels;
};

type ScannerProps = {
  labels: ScannerLabels;
  initialQuery?: string;
};

type CameraState = "idle" | "starting" | "running" | "stopped" | "unsupported" | "denied" | "error";

/** Cooldown between accepting the same barcode again (ms). */
const DEDUP_WINDOW_MS = 2000;
/** Pause after a successful scan before resuming detection (ms). */
const COOLDOWN_MS = 1500;

export function Scanner({ labels, initialQuery }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<BarcodeDetectorLike | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastCodeRef = useRef<string | null>(null);
  const lastCodeTimeRef = useRef<number>(0);
  const lastTickRef = useRef<number>(0);
  const cooldownRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pausedRef = useRef(false);

  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [engine, setEngine] = useState<DetectorEngine | null>(null);
  const [manualValue, setManualValue] = useState(initialQuery ?? "");
  const [result, setResult] = useState<ScanLookupResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lookupError, setLookupError] = useState<string | null>(null);

  // P9.1 state
  const [continuousMode] = useState(true);
  const [scanCount, setScanCount] = useState(0);
  const [muted, setMutedState] = useState(false);
  const [history, setHistory] = useState<ScanHistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [quickAddBarcode, setQuickAddBarcode] = useState<string | null>(null);

  // Load initial state on mount
  useEffect(() => {
    const mutedState = isMuted();
    const history = getScanHistory();

    startTransition(() => {
      setMutedState(mutedState);
      setHistory(history);
    });
  }, []);

  const toggleMute = useCallback(() => {
    const next = !muted;
    setMutedState(next);
    setMuted(next);
  }, [muted]);

  const stopCamera = useCallback(() => {
    if (cooldownRef.current) {
      clearTimeout(cooldownRef.current);
      cooldownRef.current = null;
    }
    pausedRef.current = false;
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
    (code: string, fromCamera = false) => {
      setLookupError(null);
      startTransition(async () => {
        const res = await lookupItemByCodeAction(code);
        if (!res.ok) {
          setLookupError(res.error || labels.lookupError);
          if (fromCamera) scanError();
          return;
        }

        setResult(res);

        if (res.found) {
          if (fromCamera) scanSuccess();
          addScanEntry({
            barcode: code,
            itemName: res.item.name,
            itemId: res.item.id,
            found: true,
            quantity: 1,
          });
          setHistory(getScanHistory());
          setScanCount((c) => c + 1);
        } else {
          if (fromCamera) scanError();
          addScanEntry({
            barcode: code,
            itemName: null,
            itemId: null,
            found: false,
            quantity: 0,
          });
          setHistory(getScanHistory());
          setScanCount((c) => c + 1);
          // Auto-open quick add when scanning unknown barcode
          if (fromCamera && continuousMode) {
            setQuickAddBarcode(code);
          }
        }
      });
    },
    [labels.lookupError, continuousMode],
  );

  const tickRef = useRef<() => void>(() => {});

  useEffect(() => {
    const tick = () => {
      if (!detectorRef.current || !videoRef.current || pausedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
        return;
      }
      const now = performance.now();
      // Throttle detection to ~6 FPS
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
              if (!value) {
                rafRef.current = requestAnimationFrame(tick);
                return;
              }

              const now = performance.now();
              // Dedup: ignore same barcode within DEDUP_WINDOW_MS
              if (value === lastCodeRef.current && now - lastCodeTimeRef.current < DEDUP_WINDOW_MS) {
                rafRef.current = requestAnimationFrame(tick);
                return;
              }

              lastCodeRef.current = value;
              lastCodeTimeRef.current = now;
              setManualValue(value);
              handleLookup(value, true);

              if (continuousMode) {
                // Pause scanning briefly, then resume
                pausedRef.current = true;
                cooldownRef.current = setTimeout(() => {
                  pausedRef.current = false;
                  cooldownRef.current = null;
                }, COOLDOWN_MS);
                rafRef.current = requestAnimationFrame(tick);
              } else {
                stopCamera();
              }
              return;
            }
          }
          rafRef.current = requestAnimationFrame(tick);
        })
        .catch(() => {
          rafRef.current = requestAnimationFrame(tick);
        });
    };
    tickRef.current = tick;
  }, [handleLookup, stopCamera, continuousMode]);

  const startCamera = useCallback(async () => {
    setLookupError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraState("unsupported");
      return;
    }

    setCameraState("starting");

    const created = await createDetector();
    if (!created) {
      setCameraState("unsupported");
      return;
    }
    detectorRef.current = created.detector;
    setEngine(created.engine);

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
      lastCodeTimeRef.current = 0;
      pausedRef.current = false;
      setCameraState("running");
      rafRef.current = requestAnimationFrame(() => tickRef.current());
    } catch (err) {
      const name = (err as { name?: string }).name;
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        setCameraState("denied");
      } else {
        setCameraState("error");
      }
    }
  }, []);

  // biome-ignore lint/correctness/useExhaustiveDependencies: mount-only effect
  useEffect(() => {
    if (initialQuery && initialQuery.trim().length > 0) {
      startTransition(() => {
        handleLookup(initialQuery.trim());
      });
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

  function handleClearHistory() {
    clearScanHistory();
    setHistory([]);
  }

  function handleQuickAddCreated(_item: { id: string; name: string; sku: string }) {
    setQuickAddBarcode(null);
    // Re-lookup the barcode to show the newly created item
    if (manualValue) {
      handleLookup(manualValue, false);
    }
  }

  const toggleFullscreen = useCallback(() => {
    setFullscreen((f) => !f);
  }, []);

  const isCameraRunning = cameraState === "running" || cameraState === "starting";

  const containerClass = fullscreen
    ? "fixed inset-0 z-50 bg-background flex flex-col"
    : "grid gap-6 lg:grid-cols-[1.1fr_1fr]";

  return (
    <>
      <div className={containerClass}>
        <div className={fullscreen ? "flex-1 flex flex-col" : "space-y-4"}>
          {/* Camera card */}
          <Card className={fullscreen ? "flex-1 flex flex-col border-0 rounded-none" : ""}>
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5" />
                  {labels.cameraHeading}
                </CardTitle>
                <div className="flex items-center gap-1.5">
                  {scanCount > 0 ? (
                    <Badge variant="default" className="text-xs font-mono">
                      {scanCount}
                    </Badge>
                  ) : null}
                  {cameraState === "starting" ? (
                    <Badge variant="outline" className="gap-1 text-xs">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      {labels.engineLoading}
                    </Badge>
                  ) : engine === "native" ? (
                    <Badge variant="secondary" className="text-xs">
                      {labels.engineNative}
                    </Badge>
                  ) : engine === "zxing" ? (
                    <Badge variant="outline" className="text-xs">
                      {labels.engineZxing}
                    </Badge>
                  ) : null}
                </div>
              </div>
              {!fullscreen ? (
                <p className="text-sm text-muted-foreground">{labels.cameraSubtitle}</p>
              ) : null}
            </CardHeader>
            <CardContent className={fullscreen ? "flex-1 flex flex-col gap-3 p-2" : "space-y-3"}>
              {/* Video area */}
              <div
                className={`relative overflow-hidden rounded-lg border border-border bg-black ${
                  fullscreen ? "flex-1" : "aspect-video"
                }`}
              >
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

                {/* Scanning status overlay */}
                {cameraState === "running" ? (
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 text-xs text-white bg-black/50 rounded-full px-2 py-1">
                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      {labels.scanningStatus}
                    </span>
                    {continuousMode ? (
                      <span className="text-xs text-white bg-black/50 rounded-full px-2 py-1">
                        {labels.continuousMode}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Bottom-anchored controls (thumb zone) */}
              <div className="flex flex-wrap items-center gap-2">
                {isCameraRunning ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={stopCamera}
                    className="h-12 px-4"
                  >
                    <CameraOff className="h-4 w-4 mr-1.5" />
                    {labels.stopCamera}
                  </Button>
                ) : (
                  <Button type="button" onClick={startCamera} className="h-12 px-6">
                    <Camera className="h-4 w-4 mr-1.5" />
                    {labels.startCamera}
                  </Button>
                )}

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={toggleMute}
                  aria-label={muted ? labels.unmute : labels.mute}
                >
                  {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12"
                  onClick={toggleFullscreen}
                  aria-label={fullscreen ? labels.exitFullscreen : labels.fullscreen}
                >
                  {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-12 w-12 relative"
                  onClick={() => setShowHistory((v) => !v)}
                  aria-label={labels.history}
                >
                  <Clock className="h-5 w-5" />
                  {history.length > 0 ? (
                    <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-primary text-[10px] text-primary-foreground flex items-center justify-center font-mono">
                      {history.length > 9 ? "9+" : history.length}
                    </span>
                  ) : null}
                </Button>
              </div>

              {/* Camera alerts */}
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

          {/* Manual entry — hidden in fullscreen */}
          {!fullscreen ? (
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
                      className="h-12"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isPending || manualValue.trim() === ""}
                    className="h-12"
                  >
                    {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {labels.manualSubmit}
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>

        {/* Right column: result + history */}
        <div className={fullscreen ? "hidden" : "space-y-4"}>
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

          {/* Found result */}
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

                <div className="flex flex-wrap gap-2 pt-2">
                  <Button asChild className="h-12">
                    <Link href={`/items/${result.item.id}`}>
                      <Package className="h-4 w-4" />
                      {labels.resultViewItem}
                    </Link>
                  </Button>
                  <Button asChild variant="outline" className="h-12">
                    <Link href={`/movements/new?itemId=${result.item.id}`}>
                      <ArrowLeftRight className="h-4 w-4" />
                      {labels.resultRecordMovement}
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Not found result */}
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
                  <Button onClick={() => setQuickAddBarcode(result.query)} className="h-12">
                    <Plus className="h-4 w-4" />
                    {labels.resultNewItem}
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : null}

          {/* Scan history panel */}
          {showHistory ? (
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    {labels.history}
                  </CardTitle>
                  <div className="flex gap-1">
                    {history.length > 0 ? (
                      <Button variant="ghost" size="sm" onClick={handleClearHistory}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="sm" onClick={() => setShowHistory(false)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {history.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{labels.noHistory}</p>
                ) : (
                  <ul className="divide-y divide-border max-h-64 overflow-y-auto -mx-1">
                    {history.slice(0, 20).map((entry) => (
                      <li
                        key={entry.id}
                        className="flex items-center justify-between px-1 py-2 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">
                            {entry.found ? entry.itemName : entry.barcode}
                          </p>
                          <p className="text-xs text-muted-foreground font-mono">
                            {entry.barcode}
                            {" · "}
                            {new Date(entry.timestamp).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {entry.found ? (
                            <Badge variant="secondary" className="text-xs">
                              <Check className="h-3 w-3" />
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs text-amber-600">
                              <AlertTriangle className="h-3 w-3" />
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {/* Quick-add sheet for unknown barcodes */}
      <QuickAddSheet
        open={quickAddBarcode !== null}
        barcode={quickAddBarcode ?? ""}
        labels={labels.quickAdd}
        onClose={() => setQuickAddBarcode(null)}
        onCreated={handleQuickAddCreated}
      />
    </>
  );
}
