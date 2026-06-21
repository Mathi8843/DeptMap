"use client";
import { useRef, useCallback } from "react";
import { DataProvider } from "@/lib/contexts/DataContext";
import { ScanProvider } from "@/lib/contexts/ScanContext";
import { AppContextProvider } from "@/lib/AppContext";

export default function DataAndAppProviders({ children }: { children: React.ReactNode }) {
  const triggerScanRef = useRef<(repoId?: string) => Promise<void>>(async () => {});

  const onNewAlert = useCallback(() => {}, []);

  return (
    <DataProvider triggerScanRef={triggerScanRef} onNewAlert={onNewAlert}>
      <ScanProvider triggerScanRef={triggerScanRef}>
        <AppContextProvider>
          {children}
        </AppContextProvider>
      </ScanProvider>
    </DataProvider>
  );
}
