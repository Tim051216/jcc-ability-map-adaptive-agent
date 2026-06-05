import React from "react";
import { ExternalLink } from "lucide-react";
import { studentApi, type ResourceSourceFileRef } from "../lib/studentApi";

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

  return (
    <div className="rounded-[28px] border border-outline-variant/35 bg-[#eef3f8] p-4 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3">
        <div className="text-sm text-on-surface-variant">PDF preview</div>
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
      <div className="min-h-[78vh] rounded-[24px] bg-[#dde5ee] p-4">
        {previewUrl ? (
          <iframe
            src={previewUrl}
            title={file.display_name}
            className="min-h-[72vh] w-full rounded-[20px] border-0 bg-white shadow-[0_20px_60px_rgba(15,23,42,0.12)]"
          />
        ) : (
          <div className="flex min-h-[72vh] items-center justify-center rounded-[20px] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-700">
            In-app PDF preview is unavailable. Please use the original-file button.
          </div>
        )}
      </div>
    </div>
  );
}
