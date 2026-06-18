import React, { useEffect, useState } from "react";
import { ExternalLink, LoaderCircle } from "lucide-react";
import { studentApi, type ResourceSourceFileRef } from "../lib/studentApi";

function resolvePreviewUrl(file: ResourceSourceFileRef) {
  return studentApi.buildResourceSourceFileUrl(file.preview_url || file.open_url);
}

function resolveOpenUrl(file: ResourceSourceFileRef) {
  return studentApi.buildResourceSourceFileUrl(file.open_url);
}

async function openOriginalFile(file: ResourceSourceFileRef) {
  const blob = await studentApi.fetchResourceFileBlob(file.open_url);
  const objectUrl = URL.createObjectURL(blob);
  const popup = window.open(objectUrl, "_blank", "noopener,noreferrer");

  if (!popup) {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.target = "_blank";
    anchor.rel = "noreferrer";
    anchor.click();
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export function PdfPreview({ file }: { file: ResourceSourceFileRef }) {
  const previewUrl = resolvePreviewUrl(file);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [previewUrl, file.file_id]);

  return (
    <div className="overflow-hidden rounded-[32px] border border-[#e6ebf0] bg-white shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <div className="border-b border-[#edf1f5] bg-[linear-gradient(180deg,#fcfdff_0%,#f6f8fb_100%)] px-6 py-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-[#8a94a3]">文档阅读模式</div>
            <div className="mt-2 text-sm leading-7 text-[#4b5563]">文档会优先在当前工作台内展示，原始文件入口始终保留。</div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[#e6ebf0] bg-white px-3 py-1 text-[11px] font-medium text-[#5b6574]">文档</span>
            <span className="inline-flex items-center rounded-full border border-[#e6ebf0] bg-white px-3 py-1 text-[11px] font-medium text-[#5b6574]">
              {file.file_size ? `${Math.round(file.file_size / 1024)} KB` : "大小未知"}
            </span>
          </div>
        </div>
        <div className="mt-4">
          <button
            type="button"
            onClick={() => {
              void openOriginalFile(file);
            }}
            className="inline-flex items-center gap-2 rounded-full border border-[#e5e7eb] bg-white px-4 py-2 text-xs font-semibold text-[#111827] transition-colors hover:bg-[#f8fafc]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            打开原始文件
          </button>
        </div>
      </div>

      {failed ? (
        <div className="flex min-h-[64vh] flex-col items-center justify-center px-6 text-center">
          <div className="text-lg font-semibold tracking-[-0.02em] text-[#111827]">页内预览暂时不可用</div>
          <div className="mt-2 max-w-xl text-sm leading-7 text-[#6b7280]">
            当前转换后的 PDF 或文档预览没有成功返回，你仍然可以直接打开原始文件继续查看完整内容。
          </div>
          <button
            type="button"
            onClick={() => {
              void openOriginalFile(file);
            }}
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-[#111827] px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#1f2937]"
          >
            <ExternalLink className="h-4 w-4" />
            打开原始文件
          </button>
        </div>
      ) : (
        <div className="relative bg-[linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] p-5">
          {!loaded ? (
            <div className="absolute left-8 right-8 top-8 z-10 flex justify-center">
              <div className="w-full max-w-lg rounded-full border border-[#e5e7eb] bg-white/94 px-5 py-3 text-center shadow-[0_14px_32px_rgba(15,23,42,0.10)] backdrop-blur">
                <div className="flex items-center justify-center gap-3 text-sm text-[#4b5563]">
                  <LoaderCircle className="h-4 w-4 animate-spin text-[#6b7280]" />
                  <span className="font-medium">文档阅读视图准备中，转换完成后会自动展示正文</span>
                </div>
              </div>
            </div>
          ) : null}
          <div className="overflow-hidden rounded-[28px] border border-white/80 bg-white shadow-[0_18px_40px_rgba(15,23,42,0.10)]">
            <iframe
              title={file.display_name}
              src={previewUrl}
              className="h-[68vh] min-h-[560px] w-full bg-white"
              onLoad={() => setLoaded(true)}
              onError={() => {
                setLoaded(true);
                setFailed(true);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
