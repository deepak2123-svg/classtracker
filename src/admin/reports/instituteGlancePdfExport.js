import { formatDurationShort } from "../utils/adminDates.js";
import { formatExportPdfTime } from "../utils/adminText.js";
import { triggerBlobDownload } from "./canvasExportUtils.js";
import {
  _avatarInitials,
  _printHtml,
  buildInstituteGlanceSummaryHtml,
  formatInstituteReportEntryDate,
} from "./instituteGlanceHtmlUtils.js";
import {
  getInstituteGlancePeriodMeta,
  instituteGlancePdfFilename,
  instituteGlanceZipFilename,
  ledgrReportDownloadFilename,
} from "./instituteGlanceReportUtils.js";
import {
  instituteGlanceLastActivityLabel,
  instituteGlanceTeacherHoursLabel,
  instituteGlanceTeacherSectionCaption,
  summariseInstituteGlanceRows,
} from "./instituteGlanceRows.js";

let instituteGlanceExportRuntimePromise = null;

async function loadInstituteGlanceExportRuntime(){
  if(!instituteGlanceExportRuntimePromise){
    instituteGlanceExportRuntimePromise = Promise.all([
      import("jspdf"),
      import("jspdf-autotable"),
      import("jszip"),
    ]).then(([jspdfModule, autoTableModule, jszipModule]) => ({
      jsPDF: jspdfModule.jsPDF,
      autoTable: autoTableModule.default,
      JSZip: jszipModule.default,
    }));
  }
  return instituteGlanceExportRuntimePromise;
}

export async function downloadInstituteGlanceSummaryPdf({ rows, summary, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "", scopeLabel = "All institutes", scopeFilePart = "all_institutes" }){
  const html = buildInstituteGlanceSummaryHtml({ rows, summary, generatedOnLabel, period, rangeStartKey, rangeEndKey, scopeLabel });
  _printHtml(html, ledgrReportDownloadFilename(scopeLabel || scopeFilePart, period, rangeStartKey, rangeEndKey, "pdf"));
}
export async function downloadInstituteGlanceInstitutePdf({ row, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const rows = row ? [row] : [];
  const html = buildInstituteGlanceSummaryHtml({
    rows,
    summary:summariseInstituteGlanceRows(rows),
    generatedOnLabel,
    period,
    rangeStartKey,
    rangeEndKey,
    scopeLabel:row?.institute || "Institute",
  });
  _printHtml(html, instituteGlancePdfFilename(row?.institute || "institute", period, rangeStartKey, rangeEndKey));
}
async function renderInstituteGlanceHtmlPdfBlob({ html, filename }){
  let response;
  try{
    response = await fetch("/api/render-ledgr-pdf", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ html, filename }),
    });
  } catch(error){
    const localHint = ["localhost", "127.0.0.1"].includes(window.location.hostname)
      ? " Centre PDFs ZIP needs the Admin app with the `/api/render-ledgr-pdf` endpoint enabled, such as deployed Admin or `vercel dev`."
      : "";
    throw new Error(`Could not reach the PDF renderer.${localHint}`);
  }
  if(!response.ok){
    let message = "Could not render institute PDF.";
    if(response.status === 404){
      message = "The PDF renderer route `/api/render-ledgr-pdf` is unavailable. Centre PDFs ZIP works from deployed Admin or `vercel dev`, not plain Vite preview.";
    }
    try{
      const payload = await response.json();
      if(payload?.error) message = payload.error;
    } catch(_error){
      // Keep the concise fallback above when the server returned a non-JSON error.
    }
    throw new Error(message);
  }
  const blob = await response.blob();
  if(!blob || blob.size === 0){
    throw new Error("The PDF renderer returned an empty file.");
  }
  return new Blob([blob], { type: "application/pdf" });
}
async function verifyInstituteZipRenderer(){
  const probeHtml = "<!DOCTYPE html><html><head><meta charset=\"UTF-8\"><title>probe</title></head><body>Ledgr ZIP probe</body></html>";
  await renderInstituteGlanceHtmlPdfBlob({ html:probeHtml, filename:"ledgr-zip-probe.pdf" });
}
export async function buildInstituteGlanceInstitutePdfBlob({ row, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const { jsPDF, autoTable } = await loadInstituteGlanceExportRuntime();
  const doc = new jsPDF({ orientation:"portrait", unit:"pt", format:"a4" });
  const periodMeta = getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey);
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 40;
  const navy = [26, 47, 90];
  const blue = [29, 78, 216];
  const green = [22, 101, 52];
  const amber = [180, 83, 9];
  const muted = [100, 116, 139];
  const teachers = row?.teacherRows || [];
  const filled = row?.filledToday || 0;
  const total = row?.totalTeachers || 0;
  const pending = row?.missingToday || 0;
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  doc.setFillColor(...navy);
  doc.rect(0, 0, pageWidth, 142, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(24);
  doc.text(row?.institute || "Institute", margin, 55, { maxWidth: pageWidth - margin * 2 });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text(`${periodMeta.title} · ${generatedOnLabel}`, margin, 78, { maxWidth: pageWidth - margin * 2 });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${filled}/${total} teachers updated · ${pending} pending · ${pct}%`, margin, 112);

  const cardY = 166;
  const cardGap = 10;
  const cardW = (pageWidth - margin * 2 - cardGap * 3) / 4;
  const metrics = [
    ["Teachers", String(total || 0)],
    [periodMeta.updatedLabel, String(filled || 0)],
    [periodMeta.pendingLabel, String(pending || 0)],
    ["Study hours", formatDurationShort(row?.totalStudyMinutes || 0)],
  ];
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (cardW + cardGap);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(221, 227, 237);
    doc.roundedRect(x, cardY, cardW, 62, 10, 10, "FD");
    doc.setTextColor(...muted);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text(String(label).toUpperCase(), x + 12, cardY + 22, { maxWidth: cardW - 24 });
    doc.setTextColor(...navy);
    doc.setFontSize(18);
    doc.text(String(value), x + 12, cardY + 47, { maxWidth: cardW - 24 });
  });

  let cursorY = 260;
  const pageBottom = 780;
  const showEntryDates = periodMeta.key !== "daily";
  const filledTeachers = row?.filledTeacherRows || [];
  const ensurePageSpace = (height = 90) => {
    if(cursorY + height <= pageBottom) return;
    doc.addPage();
    cursorY = 50;
  };

  doc.setTextColor(...navy);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text(`${periodMeta.activeLabel} (${filledTeachers.length})`, margin, cursorY);
  cursorY += 16;

  if(!filledTeachers.length){
    ensurePageSpace(54);
    doc.setFillColor(239, 246, 255);
    doc.setDrawColor(191, 219, 254);
    doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 42, 8, 8, "FD");
    doc.setTextColor(...blue);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`No teacher has uploaded during this ${periodMeta.label.toLowerCase()} period.`, margin + 12, cursorY + 25);
    cursorY += 60;
  } else {
    filledTeachers.forEach(teacher => {
      const details = Array.isArray(teacher.todayDetails) ? teacher.todayDetails : [];
      const syllabusRows = Array.isArray(teacher.syllabusDeclaredRows) ? teacher.syllabusDeclaredRows : [];
      const subjectSet = [...new Set([
        ...details.map(d => d.subject).filter(Boolean),
        ...syllabusRows.map(d => d.subject).filter(Boolean),
      ])];
      const subjectLabel = subjectSet.join(", ") || "-";
      const initials = _avatarInitials(teacher?.name || "Teacher");
      ensurePageSpace(98);

      doc.setFillColor(241, 245, 249);
      doc.setDrawColor(203, 213, 225);
      doc.roundedRect(margin, cursorY, pageWidth - margin * 2, 34, 8, 8, "FD");
      doc.setFillColor(219, 234, 254);
      doc.setDrawColor(147, 197, 253);
      doc.circle(margin + 17, cursorY + 17, 11, "FD");
      doc.setTextColor(...blue);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.text(initials, margin + 17, cursorY + 20, { align:"center" });
      doc.setTextColor(...navy);
      doc.setFontSize(11);
      doc.text(teacher?.name || "Teacher", margin + 36, cursorY + 21, { maxWidth: pageWidth - margin * 2 - 150 });
      doc.setDrawColor(147, 197, 253);
      doc.setFillColor(239, 246, 255);
      doc.roundedRect(pageWidth - margin - 72, cursorY + 8, 72, 18, 9, 9, "FD");
      doc.setTextColor(...blue);
      doc.setFontSize(8);
      doc.text(subjectLabel.slice(0, 22), pageWidth - margin - 36, cursorY + 20, { align:"center" });
      cursorY += 34;

      const entryRows = [];
      details.forEach(d => {
        const base = [
          d.section || "-",
          formatExportPdfTime(d.timeStart, d.timeEnd) || "-",
          d.title || d.subject || "-",
          d.notes || "-",
        ];
        entryRows.push(showEntryDates ? [formatInstituteReportEntryDate(d.dateKey), ...base] : base);
      });
      if(!entryRows.length){
        const base = [
          instituteGlanceTeacherSectionCaption(teacher),
          "-",
          `${teacher.todayEntries || 0} entries uploaded`,
          instituteGlanceTeacherHoursLabel(teacher),
        ];
        entryRows.push(showEntryDates ? ["-", ...base] : base);
      }

      autoTable(doc, {
        startY: cursorY,
        head: [showEntryDates ? ["Date", "Section", "Time", "Topic / Title", "Notes"] : ["Section", "Time", "Topic / Title", "Notes"]],
        body: entryRows,
        margin:{ left:margin, right:margin },
        theme:"grid",
        styles:{ font:"helvetica", fontSize:8.8, cellPadding:6, lineColor:[226,232,240], lineWidth:0.5, textColor:[31,41,55], overflow:"linebreak" },
        headStyles:{ fillColor:[248,250,252], textColor:[100,116,139], fontStyle:"bold" },
        alternateRowStyles:{ fillColor:[255,255,255] },
        columnStyles: showEntryDates
          ? {
              0:{ cellWidth:54, textColor:[31,41,55], fontStyle:"bold" },
              1:{ cellWidth:58, fontStyle:"bold" },
              2:{ cellWidth:76, textColor:muted },
              3:{ cellWidth:160 },
              4:{ cellWidth:pageWidth - margin * 2 - 54 - 58 - 76 - 160 },
            }
          : {
              0:{ cellWidth:72, fontStyle:"bold" },
              1:{ cellWidth:94, textColor:muted },
              2:{ cellWidth:176 },
              3:{ cellWidth:pageWidth - margin * 2 - 72 - 94 - 176, halign:"right", textColor:muted },
            },
        didParseCell:(hookData) => {
          if(hookData.section !== "body") return;
          const rowData = entryRows[hookData.row.index] || [];
          const isSyllabus = rowData.includes("Syllabus");
          if(!isSyllabus) return;
          hookData.cell.styles.fillColor = [251, 254, 250];
          if(String(hookData.cell.raw || "") === "Covered"){
            hookData.cell.styles.textColor = green;
            hookData.cell.styles.fontStyle = "bold";
          }
        },
      });
      cursorY = (doc.lastAutoTable?.finalY || cursorY) + 13;

      if(syllabusRows.length){
        ensurePageSpace(68);
        doc.setTextColor(...green);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text("Syllabus tracker", margin, cursorY);
        autoTable(doc, {
          startY: cursorY + 8,
          head: [["Section", "Subject", "Covered", "Status"]],
          body: syllabusRows.map(item => [
            item.section || "-",
            item.subject || subjectLabel || "-",
            `${item.coveredCount || 0} of ${item.totalCount || 0} chapters`,
            item.status || "Not started",
          ]),
          margin:{ left:margin, right:margin },
          theme:"grid",
          styles:{ font:"helvetica", fontSize:8.4, cellPadding:5, lineColor:[232,244,233], lineWidth:0.5, textColor:[31,41,55], overflow:"linebreak" },
          headStyles:{ fillColor:[251,254,250], textColor:green, fontStyle:"bold" },
          alternateRowStyles:{ fillColor:[255,255,255] },
          columnStyles:{
            0:{ cellWidth:70 },
            1:{ cellWidth:88 },
            2:{ cellWidth:118, fontStyle:"bold" },
            3:{ cellWidth:pageWidth - margin * 2 - 70 - 88 - 118, textColor:green, fontStyle:"bold" },
          },
        });
        cursorY = (doc.lastAutoTable?.finalY || cursorY) + 13;
      }
    });
  }

  cursorY += 10;
  const pendingTeachers = row?.pendingTeacherRows || [];
  if(pendingTeachers.length){
    doc.setTextColor(...amber);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("Pending follow-up", margin, cursorY);
    autoTable(doc, {
      startY: cursorY + 12,
      head: [["Teacher", "Last activity", "Classes"]],
      body: pendingTeachers.map(teacher => [
        teacher?.name || "Teacher",
        teacher?.lastActivityLabel || instituteGlanceLastActivityLabel(teacher),
        (teacher?.classNames || teacher?.sectionNames || []).join(", ") || "-",
      ]),
      margin:{ left:margin, right:margin },
      styles:{ font:"helvetica", fontSize:8.7, cellPadding:6, lineColor:[253,230,138], lineWidth:0.5, textColor:[55,65,81], overflow:"linebreak" },
      headStyles:{ fillColor:amber, textColor:[255,255,255], fontStyle:"bold" },
      alternateRowStyles:{ fillColor:[255,251,235] },
    });
  } else {
    doc.setTextColor(...green);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.text(total ? "All linked teachers are updated for this period." : "No teacher records are linked to this centre yet.", margin, cursorY);
  }

  const pageCount = doc.internal.getNumberOfPages();
  for(let page = 1; page <= pageCount; page += 1){
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Ledgr · ${periodMeta.label} centre PDF`, margin, 820);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - margin, 820, { align:"right" });
    doc.setTextColor(...blue);
  }

  return new Blob([doc.output("arraybuffer")], { type:"application/pdf" });
}
export async function downloadInstituteGlanceInstituteZip({ rows, generatedOnLabel, period = "daily", rangeStartKey = "", rangeEndKey = "" }){
  const { JSZip } = await loadInstituteGlanceExportRuntime();
  const safeRows = Array.isArray(rows) ? rows : [];
  await verifyInstituteZipRenderer();
  const zip = new JSZip();
  const folder = zip.folder("Ledgr centre PDFs") || zip;
  for(const row of safeRows){
    const filename = instituteGlancePdfFilename(row?.institute || "institute", period, rangeStartKey, rangeEndKey);
    const rows = [row];
    const html = buildInstituteGlanceSummaryHtml({
      rows,
      summary:summariseInstituteGlanceRows(rows),
      generatedOnLabel,
      period,
      rangeStartKey,
      rangeEndKey,
      scopeLabel:row?.institute || "Institute",
    });
    const blob = await renderInstituteGlanceHtmlPdfBlob({ html, filename });
    folder.file(filename, await blob.arrayBuffer());
  }
  const readme = [
    "Ledgr Centre PDFs",
    "",
    "This ZIP contains one separate PDF report for each selected institute.",
    "Every institute PDF is rendered from the same print template as the combined PDF report.",
    "",
    `Generated: ${generatedOnLabel}`,
    `Period: ${getInstituteGlancePeriodMeta(period, rangeStartKey, rangeEndKey).title}`,
    `Centres: ${safeRows.length}`,
  ].join("\n");
  zip.file("README.txt", readme);
  const zipBlob = await zip.generateAsync({
    type:"blob",
    mimeType:"application/zip",
    compression:"DEFLATE",
    compressionOptions:{ level:6 },
  });
  if(!zipBlob || zipBlob.size === 0){
    throw new Error("The Centre PDFs ZIP was empty. Please try again.");
  }
  triggerBlobDownload(
    new Blob([zipBlob], { type:"application/zip" }),
    instituteGlanceZipFilename(period, rangeStartKey, rangeEndKey, safeRows.length),
  );
}
