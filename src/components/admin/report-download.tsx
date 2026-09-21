"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileText, Loader2, Printer } from "lucide-react";
import { generateStatusReport } from "@/lib/actions/status-report";
import { toast } from "sonner";

/** Minimal Markdown -> HTML for the printable view: tables, headings, bold, rules. */
function mdToHtml(md: string): string {
  const out: string[] = [];
  const lines = md.split("\n");
  let inTable = false;

  const inline = (s: string) =>
    s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  const closeTable = () => {
    if (inTable) {
      out.push("</tbody></table>");
      inTable = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const t = line.trim();

    if (/^\|[\s:|-]+\|$/.test(t)) continue; // separator row

    if (t.startsWith("|")) {
      const cells = t.slice(1, -1).split("|").map((c) => c.trim());
      const isHeader =
        !inTable && /^\|[\s:|-]+\|$/.test((lines[i + 1] ?? "").trim());
      if (isHeader) {
        out.push("<table><thead><tr>");
        for (const c of cells) out.push(`<th>${inline(c)}</th>`);
        out.push("</tr></thead><tbody>");
        inTable = true;
      } else {
        if (!inTable) {
          out.push("<table><tbody>");
          inTable = true;
        }
        out.push("<tr>");
        for (const c of cells) out.push(`<td>${inline(c)}</td>`);
        out.push("</tr>");
      }
      continue;
    }

    closeTable();

    if (t.startsWith("### ")) out.push(`<h3>${inline(t.slice(4))}</h3>`);
    else if (t.startsWith("## ")) out.push(`<h2>${inline(t.slice(3))}</h2>`);
    else if (t.startsWith("# ")) out.push(`<h1>${inline(t.slice(2))}</h1>`);
    else if (t === "---") out.push("<hr>");
    else if (t.startsWith("> ")) out.push(`<blockquote>${inline(t.slice(2))}</blockquote>`);
    else if (t === "") out.push("");
    else out.push(`<p>${inline(t)}</p>`);
  }
  closeTable();
  return out.join("\n");
}

function printableDocument(md: string): string {
  return `<!doctype html>
<html><head><meta charset="utf-8">
<title>Kaushalam — Requirement Gathering Status</title>
<style>
  @page { size: A4; margin: 16mm; }
  body { font-family: "IBM Plex Sans","Segoe UI",Roboto,system-ui,sans-serif;
         font-size: 11px; line-height: 1.5; color: #1A1A1A; max-width: 900px;
         margin: 0 auto; padding: 24px; }
  h1 { font-size: 20px; color: #620124; margin: 0 0 4px; letter-spacing: -0.01em; }
  h2 { font-size: 14px; margin: 26px 0 8px; padding-bottom: 5px;
       border-bottom: 2px solid #620124; page-break-after: avoid; }
  h3 { font-size: 12px; margin: 16px 0 6px; page-break-after: avoid; }
  p  { margin: 0 0 7px; }
  hr { border: 0; border-top: 1px solid #E4DFDB; margin: 18px 0; }
  blockquote { margin: 10px 0; padding: 8px 12px; background: #FBF1DC;
               border-left: 3px solid #9A6A12; color: #6b4e0e; font-size: 10.5px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0 14px;
          font-size: 10.5px; page-break-inside: avoid; }
  th { text-align: left; font-weight: 600; font-size: 10px; color: #6B6462;
       padding: 6px 8px; border-bottom: 2px solid #E4DFDB; background: #FAFAFB; }
  td { padding: 5px 8px; border-bottom: 1px solid #EFEBE8; }
  td:not(:first-child), th:not(:first-child) { text-align: right;
       font-variant-numeric: tabular-nums; }
  tr:last-child td { border-bottom: 0; }

  /* Screen-only toolbar. Styles live here rather than inline, because an inline
     display value outranks the class rule and would survive @media print. */
  .noprint { margin-bottom: 16px; padding: 10px 14px; background: #FBEFE3;
             border-radius: 6px; display: flex; align-items: center;
             justify-content: space-between; gap: 12px; }
  .noprint span { font-size: 11px; color: #620124; }
  .noprint button { font: inherit; font-size: 11px; padding: 6px 14px;
             background: #620124; color: #fff; border: 0; border-radius: 5px;
             cursor: pointer; }
  .noprint button:hover { background: #7B1A36; }

  @media print {
    body { padding: 0; }
    .noprint { display: none !important; }
  }
</style></head>
<body>
<div class="noprint">
  <span>Use your browser's Print dialog and choose <strong>Save as PDF</strong>.</span>
  <button onclick="window.print()">Print</button>
</div>
${mdToHtml(md)}
</body></html>`;
}

export function ReportDownload() {
  const [busy, setBusy] = useState<"md" | "print" | null>(null);

  async function run(mode: "md" | "print") {
    setBusy(mode);
    try {
      const { markdown } = await generateStatusReport();
      const date = new Date().toISOString().split("T")[0];

      if (mode === "md") {
        const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `Kaushalam_Requirement_Gathering_Status_${date}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        toast.success("Report downloaded");
      } else {
        // Served as a Blob URL rather than document.write: avoids the XSS-prone
        // pattern and gives the new tab a real document to print from.
        const blob = new Blob([printableDocument(markdown)], {
          type: "text/html;charset=utf-8",
        });
        const url = URL.createObjectURL(blob);
        const w = window.open(url, "_blank");
        if (!w) {
          URL.revokeObjectURL(url);
          toast.error("Pop-up blocked — allow pop-ups to open the printable report.");
          setBusy(null);
          return;
        }
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        toast.success("Report opened — print to PDF");
      }
    } catch {
      toast.error("Could not generate the report.");
    }
    setBusy(null);
  }

  return (
    <div className="flex gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={() => run("print")}
        disabled={busy !== null}
        className="gap-1.5"
      >
        {busy === "print" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
        Report — PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={() => run("md")}
        disabled={busy !== null}
        className="gap-1.5"
      >
        {busy === "md" ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
        Markdown
      </Button>
    </div>
  );
}
