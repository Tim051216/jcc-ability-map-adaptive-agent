import React, { useEffect, useRef, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Document, Page, pdfjs } from "react-pdf";
import { studentApi, type ResourceSourceFileRef } from "../lib/studentApi";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();

function buildInAppFileUrl(path: string | null | undefined) {
  if (!path) {
    return "";
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  return path;
}

export function PdfPreview({ file }: { file: ResourceSourceFileRef }) {
  const previewPath = file.preview_url || file.open_url;
  const previewUrl = previewPath.startsWith("http://") || previewPath.startsWith("https://")
    ? studentApi.buildResourceSourceFileUrl(previewPath)
    : previewPath;
  const openUrl = buildInAppFileUrl(file.open_url) || previewUrl;
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(960);
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfError, setPdfError] = useState<string | null>(null);

  useEffect(() => {
    setPageNumber(1);
    setNumPages(0);
    setPdfError(null);
  }, [previewUrl]);

  useEffect(() => {
    const element = hostRef.current;
    if (!element) {
      return;
    }

    const updateWidth = () => {
      setContainerWidth(Math.max(320, Math.floor(element.clientWidth - 32)));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="rounded-[28px] border border-outline-variant/35 bg-[#eef3f8] p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
        <div className="text-sm text-on-surface-variant">{numPages ? `Page ${pageNumber} / ${numPages}` : "PDF preview"}</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.max(1, value - 1))}
            disabled={pageNumber <= 1}
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-2 text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPageNumber((value) => Math.min(numPages || value, value + 1))}
            disabled={!numPages || pageNumber >= numPages}
            className="inline-flex items-center gap-1 rounded-full border border-outline-variant bg-white px-3 py-2 text-sm font-bold text-on-surface disabled:cursor-not-allowed disabled:opacity-45"
          >
            Next
          </button>
          <a
            href={openUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-outline-variant bg-white px-4 py-2 text-sm font-bold text-on-surface transition-colors hover:border-primary/40 hover:text-primary"
          >
            <ExternalLink className="h-4 w-4" />
            Open original
          </a>
        </div>
      </div>
      <div ref={hostRef} className="min-h-[78vh] rounded-[24px] bg-[#dde5ee] p-4">
        <Document
          file={previewUrl}
          loading={<div className="flex min-h-[72vh] items-center justify-center rounded-[20px] bg-white text-sm text-on-surface-variant">Loading PDF...</div>}
          onLoadSuccess={({ numPages: loadedPages }) => {
            setNumPages(loadedPages);
            setPdfError(null);
          }}
          onLoadError={(error) => {
            const message = error.message || "PDF preview render failed";
            console.error("PDF preview load error:", error);
            setPdfError(message);
          }}
          error={
            <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
              <div>In-app PDF preview failed. Please use the original-file button.</div>
              {pdfError ? <div className="mt-2 break-all text-xs text-amber-800/90">{pdfError}</div> : null}
            </div>
          }
          className="flex justify-center"
        >
          {!pdfError ? (
            <Page
              pageNumber={pageNumber}
              width={Math.min(containerWidth, 1100)}
              renderAnnotationLayer
              renderTextLayer
              className="overflow-hidden rounded-[20px] bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
            />
          ) : null}
        </Document>
      </div>
    </div>
  );
}
