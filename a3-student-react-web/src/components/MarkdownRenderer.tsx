import { Suspense, lazy } from "react";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

const LazyMarkdownRendererImpl = lazy(() => import("./MarkdownRendererImpl"));

export default function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  return (
    <Suspense
      fallback={
        <div className={`whitespace-pre-wrap text-sm leading-7 text-[#475467] ${className}`.trim()}>
          {content}
        </div>
      }
    >
      <LazyMarkdownRendererImpl content={content} className={className} />
    </Suspense>
  );
}
