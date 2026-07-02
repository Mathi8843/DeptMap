"use client";
import React, { useState, useEffect } from "react";
import clsx from "clsx";
import { GitCompare, AlignLeft } from "lucide-react";

interface CodeDiffViewerProps {
  oldCode: string;
  newCode: string;
  filename?: string;
}

// ── Pure-CSS diff renderer (no external lib SSR issues) ──────────────────────
function buildUnifiedDiff(oldCode: string, newCode: string) {
  const oldLines = oldCode.split("\n");
  const newLines = newCode.split("\n");

  // Simple LCS-based diff
  const m = oldLines.length;
  const n = newLines.length;

  // Build LCS table
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    new Array(n + 1).fill(0)
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to build diff
  type DiffLine = { type: "equal" | "removed" | "added"; content: string; oldNum?: number; newNum?: number };
  const diff: DiffLine[] = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      diff.unshift({ type: "equal", content: oldLines[i - 1], oldNum: i, newNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      diff.unshift({ type: "added", content: newLines[j - 1], newNum: j });
      j--;
    } else {
      diff.unshift({ type: "removed", content: oldLines[i - 1], oldNum: i });
      i--;
    }
  }

  return diff;
}

// Collapse unchanged runs to show only context around changes
function collapseUnchanged(
  diff: ReturnType<typeof buildUnifiedDiff>,
  contextLines = 3
) {
  const changed = new Set<number>();
  diff.forEach((l, idx) => {
    if (l.type !== "equal") {
      for (let k = Math.max(0, idx - contextLines); k <= Math.min(diff.length - 1, idx + contextLines); k++) {
        changed.add(k);
      }
    }
  });

  type CollapsedLine = ReturnType<typeof buildUnifiedDiff>[0] | { type: "collapse"; count: number };
  const result: CollapsedLine[] = [];
  let collapseStart = -1;

  for (let idx = 0; idx < diff.length; idx++) {
    if (changed.has(idx)) {
      if (collapseStart !== -1) {
        const count = idx - collapseStart;
        if (count > 0) result.push({ type: "collapse", count });
        collapseStart = -1;
      }
      result.push(diff[idx]);
    } else {
      if (collapseStart === -1) collapseStart = idx;
    }
  }
  if (collapseStart !== -1) {
    const count = diff.length - collapseStart;
    if (count > 0) result.push({ type: "collapse", count });
  }

  return result;
}

export default function CodeDiffViewer({ oldCode, newCode, filename }: CodeDiffViewerProps) {
  const [mode, setMode] = useState<"split" | "unified">("unified");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  if (!mounted) {
    return (
      <div className="h-64 bg-[#030308] rounded-xl flex items-center justify-center text-slate-600 font-mono text-xs">
        Loading diff...
      </div>
    );
  }

  const diff = buildUnifiedDiff(
    (oldCode || "").trimEnd(),
    (newCode || "").trimEnd()
  );
  const collapsed = collapseUnchanged(diff, 3);

  const addedCount = diff.filter(l => l.type === "added").length;
  const removedCount = diff.filter(l => l.type === "removed").length;

  const renderLineContent = (content: string) => {
    // Escape HTML and preserve spacing
    return content === "" ? "\u00A0" : content;
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/8 shadow-2xl shadow-black/60 flex flex-col">
      {/* Toolbar */}
      <div className="bg-[#0a0a18] border-b border-white/8 px-4 py-3 flex items-center justify-between gap-4 flex-shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <GitCompare size={14} className="text-indigo-400 flex-shrink-0" />
          {filename && (
            <span className="font-mono text-[11px] text-slate-400 truncate">{filename}</span>
          )}
          <div className="flex items-center gap-2 font-mono text-[10px] font-bold">
            <span className="text-emerald-400">+{addedCount}</span>
            <span className="text-rose-400">-{removedCount}</span>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-slate-900/60 rounded-lg p-1 border border-white/5 flex-shrink-0">
          <button
            onClick={() => setMode("unified")}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[9px] uppercase tracking-[1px] font-bold transition-all cursor-pointer",
              mode === "unified"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <AlignLeft size={10} />
            Unified
          </button>
          <button
            onClick={() => setMode("split")}
            className={clsx(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md font-mono text-[9px] uppercase tracking-[1px] font-bold transition-all cursor-pointer",
              mode === "split"
                ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                : "text-slate-500 hover:text-slate-300"
            )}
          >
            <GitCompare size={10} />
            Split
          </button>
        </div>
      </div>

      {/* Diff body */}
      <div className="overflow-auto bg-[#030308] flex-1" style={{ maxHeight: "520px" }}>
        {mode === "unified" ? (
          <UnifiedView collapsed={collapsed} renderLineContent={renderLineContent} />
        ) : (
          <SplitView diff={diff} renderLineContent={renderLineContent} />
        )}
      </div>
    </div>
  );
}

// ── Unified view ─────────────────────────────────────────────────────────────
function UnifiedView({
  collapsed,
  renderLineContent,
}: {
  collapsed: ReturnType<typeof collapseUnchanged>;
  renderLineContent: (c: string) => string;
}) {
  return (
    <table className="w-full border-collapse font-mono text-xs leading-relaxed" style={{ tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: "3rem" }} />
        <col style={{ width: "3rem" }} />
        <col style={{ width: "1.5rem" }} />
        <col />
      </colgroup>
      <tbody>
        {collapsed.map((line, idx) => {
          if (line.type === "collapse") {
            return (
              <tr key={idx} className="bg-slate-950/80">
                <td colSpan={4} className="px-4 py-1.5 text-slate-600 text-[10px] font-mono select-none border-y border-white/4">
                  ··· {line.count} unchanged line{line.count !== 1 ? "s" : ""} hidden ···
                </td>
              </tr>
            );
          }

          const l = line as { type: "equal" | "removed" | "added"; content: string; oldNum?: number; newNum?: number };

          const rowBg =
            l.type === "removed" ? "bg-rose-950/40 hover:bg-rose-950/60" :
            l.type === "added"   ? "bg-emerald-950/35 hover:bg-emerald-950/55" :
            "hover:bg-white/[0.015]";

          const prefix =
            l.type === "removed" ? "−" :
            l.type === "added"   ? "+" :
            " ";

          const prefixColor =
            l.type === "removed" ? "text-rose-500" :
            l.type === "added"   ? "text-emerald-400" :
            "text-slate-700";

          const textColor =
            l.type === "removed" ? "text-rose-200/85" :
            l.type === "added"   ? "text-emerald-200/90" :
            "text-slate-400";

          const leftGutter =
            l.type === "removed" ? "border-l-2 border-rose-500/50" :
            l.type === "added"   ? "border-l-2 border-emerald-500/50" :
            "border-l-2 border-transparent";

          return (
            <tr key={idx} className={clsx("transition-colors", rowBg)}>
              <td className="text-right pr-3 py-0.5 text-slate-600 select-none text-[10px] border-r border-white/4 w-12">
                {l.type !== "added" ? l.oldNum : ""}
              </td>
              <td className="text-right pr-3 py-0.5 text-slate-600 select-none text-[10px] border-r border-white/4 w-12">
                {l.type !== "removed" ? l.newNum : ""}
              </td>
              <td className={clsx("text-center py-0.5 select-none font-bold", prefixColor)}>
                {prefix}
              </td>
              <td className={clsx("pl-3 pr-6 py-0.5 whitespace-pre", textColor, leftGutter)}>
                {renderLineContent(l.content)}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

// ── Split view ────────────────────────────────────────────────────────────────
function SplitView({
  diff,
  renderLineContent,
}: {
  diff: ReturnType<typeof buildUnifiedDiff>;
  renderLineContent: (c: string) => string;
}) {
  // Build paired rows: match removed+added lines together
  type SplitRow = {
    left: { content: string; lineNum?: number; type: "removed" | "equal" | "empty" };
    right: { content: string; lineNum?: number; type: "added" | "equal" | "empty" };
  };

  const rows: SplitRow[] = [];
  let i = 0;
  while (i < diff.length) {
    const line = diff[i];
    if (line.type === "equal") {
      rows.push({
        left: { content: line.content, lineNum: line.oldNum, type: "equal" },
        right: { content: line.content, lineNum: line.newNum, type: "equal" },
      });
      i++;
    } else if (line.type === "removed") {
      const next = diff[i + 1];
      if (next?.type === "added") {
        rows.push({
          left: { content: line.content, lineNum: line.oldNum, type: "removed" },
          right: { content: next.content, lineNum: next.newNum, type: "added" },
        });
        i += 2;
      } else {
        rows.push({
          left: { content: line.content, lineNum: line.oldNum, type: "removed" },
          right: { content: "", type: "empty" },
        });
        i++;
      }
    } else {
      rows.push({
        left: { content: "", type: "empty" },
        right: { content: line.content, lineNum: line.newNum, type: "added" },
      });
      i++;
    }
  }

  return (
    <div className="grid grid-cols-2 divide-x divide-white/5 font-mono text-xs leading-relaxed">
      {/* Left pane - old */}
      <div>
        <div className="bg-slate-950/80 px-3 py-2 text-[9px] font-mono uppercase tracking-[1px] font-bold text-rose-400 border-b border-white/5">
          − Vulnerable Code
        </div>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "3rem" }} />
            <col />
          </colgroup>
          <tbody>
            {rows.map((row, idx) => {
              const isRemoved = row.left.type === "removed";
              const isEmpty = row.left.type === "empty";
              return (
                <tr key={idx} className={clsx(
                  "transition-colors",
                  isRemoved ? "bg-rose-950/40 hover:bg-rose-950/60" :
                  isEmpty   ? "bg-slate-950/30" :
                  "hover:bg-white/[0.015]"
                )}>
                  <td className="text-right pr-3 py-0.5 text-slate-600 select-none text-[10px] border-r border-white/4 border-l-2 border-l-transparent">
                    {row.left.lineNum ?? ""}
                  </td>
                  <td className={clsx(
                    "pl-3 pr-4 py-0.5 whitespace-pre",
                    isRemoved ? "text-rose-200/85 border-l-2 border-rose-500/50" :
                    isEmpty   ? "text-transparent border-l-2 border-transparent" :
                    "text-slate-400 border-l-2 border-transparent"
                  )}>
                    {isEmpty ? "\u00A0" : renderLineContent(row.left.content)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {/* Right pane - new */}
      <div>
        <div className="bg-slate-950/80 px-3 py-2 text-[9px] font-mono uppercase tracking-[1px] font-bold text-emerald-400 border-b border-white/5">
          + AI Fix
        </div>
        <table className="w-full border-collapse" style={{ tableLayout: "fixed" }}>
          <colgroup>
            <col style={{ width: "3rem" }} />
            <col />
          </colgroup>
          <tbody>
            {rows.map((row, idx) => {
              const isAdded = row.right.type === "added";
              const isEmpty = row.right.type === "empty";
              return (
                <tr key={idx} className={clsx(
                  "transition-colors",
                  isAdded ? "bg-emerald-950/35 hover:bg-emerald-950/55" :
                  isEmpty ? "bg-slate-950/30" :
                  "hover:bg-white/[0.015]"
                )}>
                  <td className="text-right pr-3 py-0.5 text-slate-600 select-none text-[10px] border-r border-white/4">
                    {row.right.lineNum ?? ""}
                  </td>
                  <td className={clsx(
                    "pl-3 pr-4 py-0.5 whitespace-pre",
                    isAdded ? "text-emerald-200/90 border-l-2 border-emerald-500/50" :
                    isEmpty ? "text-transparent border-l-2 border-transparent" :
                    "text-slate-400 border-l-2 border-transparent"
                  )}>
                    {isEmpty ? "\u00A0" : renderLineContent(row.right.content)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
