"use client";
import React, { createContext, useContext, useState, useEffect, useCallback, useRef, useMemo } from "react";
import { apiFetch } from "../api";
import { useData, type Repo } from "./DataContext";
import { useToast } from "./ToastContext";

export interface ScanContextType {
  isScanning: boolean;
  scanProgress: number;
  scanLogs: string[];
  scanStatus: "idle" | "queued" | "running" | "completed" | "failed";
  triggerScan: (repoId?: string) => Promise<void>;
}

const ScanContext = createContext<ScanContextType | undefined>(undefined);

export function ScanProvider({
  children,
  triggerScanRef,
}: {
  children: React.ReactNode;
  triggerScanRef: React.MutableRefObject<(repoId?: string) => Promise<void>>;
}) {
  const { triggerWebhookAlert, fetchData, repos } = useData();
  const { showToast } = useToast();

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLogs, setScanLogs] = useState<string[]>([]);
  const [scanStatus, setScanStatus] = useState<"idle" | "queued" | "running" | "completed" | "failed">("idle");

  const isScanningRef = useRef(false);
  const reposRef = useRef<Repo[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => { reposRef.current = repos; }, [repos]);
  useEffect(() => { isScanningRef.current = isScanning; }, [isScanning]);

  // Clear polling interval on unmount to prevent state updates on unmounted component
  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, []);

  const triggerScan = useCallback(async (repoId?: string) => {
    if (isScanningRef.current) return;

    let scanRepoId = repoId;
    if (!scanRepoId) {
      const currentRepos = reposRef.current;
      if (currentRepos.length > 0) {
        scanRepoId = currentRepos[0].id;
      } else {
        showToast("No repository connected to scan.", "error");
        return;
      }
    }

    const targetRepo = reposRef.current.find((r) => r.id === scanRepoId);
    const repoName = targetRepo ? targetRepo.full_name : "selected repository";

    setIsScanning(true);
    setScanStatus("queued");
    setScanProgress(0);
    setScanLogs([`[SYSTEM] Starting scan process on backend for ${repoName}...`]);

    try {
      const scanResult = await apiFetch(`/scans?repo_id=${scanRepoId}`, { method: "POST" });
      const scanId = scanResult.scan_id;

      let scanFinished = false;

      pollIntervalRef.current = setInterval(async () => {
        if (scanFinished) return;
        try {
          const statusResult = await apiFetch(`/scans/${scanId}/status`);
          setScanProgress(statusResult.progress || 0);
          setScanStatus(statusResult.status || "running");

          if (statusResult.log_messages && statusResult.log_messages.length > 0) {
            setScanLogs(statusResult.log_messages);
          }

          if (statusResult.status === "completed") {
            scanFinished = true;
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setIsScanning(false);
            setScanStatus("completed");
            showToast(`Scan complete for ${repoName}!`, "success");
            const healthScore = reposRef.current.find((r) => r.id === scanRepoId)?.health_score || 100;
            triggerWebhookAlert("#security", `Auditor scan finished for ${repoName}. Health score: ${healthScore}/100.`, "slack");
            fetchData();
          } else if (statusResult.status === "failed") {
            scanFinished = true;
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
            setIsScanning(false);
            setScanStatus("failed");
            showToast(`Scan failed for ${repoName}. Check terminal logs.`, "error");
            fetchData();
          }
        } catch (pollErr: any) {
          console.error("Error polling scan status:", pollErr);
        }
      }, 1500);
    } catch (err: any) {
      setIsScanning(false);
      setScanStatus("failed");
      showToast(err.message || "Failed to trigger scan", "error");
    }
  }, [showToast, triggerWebhookAlert, fetchData]);

  // Expose triggerScan to DataProvider via ref (for connectRepo auto-scan)
  useEffect(() => {
    triggerScanRef.current = triggerScan;
  }, [triggerScanRef, triggerScan]);

  const scanValue = useMemo(() => ({ isScanning, scanProgress, scanLogs, scanStatus, triggerScan }), [isScanning, scanProgress, scanLogs, scanStatus, triggerScan]);

  return (
    <ScanContext.Provider value={scanValue}>
      {children}
    </ScanContext.Provider>
  );
}

export function useScan() {
  const context = useContext(ScanContext);
  if (!context) {
    throw new Error("useScan must be used within a ScanProvider");
  }
  return context;
}
