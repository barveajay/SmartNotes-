
import { jsPDF } from "jspdf";
import { SmartNotes } from "../types";

export const generatePDF = (notes: SmartNotes) => {
  const doc = new jsPDF();
  const margin = 20;
  let cursorY = 20;

  const checkPage = (heightNeeded: number) => {
    if (cursorY + heightNeeded > 280) {
      doc.addPage();
      cursorY = 20;
      return true;
    }
    return false;
  };

  // Title
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(notes.title || "Lecture Notes", margin, cursorY);
  cursorY += 15;

  // Metadata
  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text(`Generated on: ${new Date(notes.timestamp).toLocaleString()}`, margin, cursorY);
  cursorY += 15;

  // Summary
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Executive Summary", margin, cursorY);
  cursorY += 7;
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  const summaryLines = doc.splitTextToSize(notes.summary, 170);
  doc.text(summaryLines, margin, cursorY);
  cursorY += (summaryLines.length * 6) + 10;

  // Key Concepts
  if (notes.keyConcepts.length > 0) {
    checkPage(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Key Concepts", margin, cursorY);
    cursorY += 7;
    doc.setFontSize(11);
    doc.setFont("helvetica", "normal");
    notes.keyConcepts.forEach((concept) => {
      const lines = doc.splitTextToSize(`• ${concept}`, 170);
      checkPage(lines.length * 6);
      doc.text(lines, margin, cursorY);
      cursorY += (lines.length * 6);
    });
    cursorY += 10;
  }

  // Grounding Sources
  if (notes.sources && notes.sources.length > 0) {
    checkPage(20);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Supplemental Resources", margin, cursorY);
    cursorY += 7;
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 255);
    notes.sources.forEach((source) => {
      const text = `${source.title}: ${source.uri}`;
      const lines = doc.splitTextToSize(text, 170);
      checkPage(lines.length * 6);
      doc.text(lines, margin, cursorY);
      cursorY += (lines.length * 6);
    });
    doc.setTextColor(0, 0, 0);
    cursorY += 10;
  }

  // Full Transcription
  doc.addPage();
  cursorY = 20;
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Transcription", margin, cursorY);
  cursorY += 10;
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const transcriptLines = doc.splitTextToSize(notes.transcription, 170);
  transcriptLines.forEach((line: string) => {
    if (checkPage(5)) {}
    doc.text(line, margin, cursorY);
    cursorY += 5;
  });

  doc.save(`${notes.title.replace(/\s+/g, '_')}_notes.pdf`);
};
