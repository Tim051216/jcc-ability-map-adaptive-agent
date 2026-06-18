import React, { useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import katexStylesheetHref from "katex/dist/katex.min.css?url";

interface MarkdownRendererImplProps {
  content: string;
  className?: string;
}

function looksLikeNaturalLanguageMath(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return false;
  const containsCjk = /[\u3400-\u9FFF]/.test(trimmed);
  const mathSignals = /[=+\-*/^_{}\\]|\\frac|\\sum|\\int|\\sqrt|\d/.test(trimmed);
  return containsCjk && !mathSignals;
}

function normalizeMathMarkdown(content: string) {
  return content
    .replace(/\$\$([\s\S]+?)\$\$/g, (full, inner: string) => {
      const trimmed = inner.trim();
      if (!looksLikeNaturalLanguageMath(trimmed)) return full;
      return `\n> ${trimmed}\n`;
    })
    .replace(/(^|[^\$])\$([^\n$]+?)\$(?!\$)/g, (full, prefix: string, inner: string) => {
      const trimmed = inner.trim();
      if (!looksLikeNaturalLanguageMath(trimmed)) return full;
      return `${prefix}\`${trimmed}\``;
    });
}

export default function MarkdownRendererImpl({ content, className = "" }: MarkdownRendererImplProps) {
  const normalizedContent = normalizeMathMarkdown(content);

  useEffect(() => {
    const existingLink = document.querySelector<HTMLLinkElement>('link[data-katex-styles="true"]');
    if (existingLink) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = katexStylesheetHref;
    link.dataset.katexStyles = "true";
    document.head.appendChild(link);
    return () => {
      if (document.querySelectorAll('link[data-katex-styles="true"]').length <= 1) {
        link.remove();
      }
    };
  }, []);

  return (
    <div className={`markdown-renderer text-sm leading-7 ${className}`.trim()}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[[rehypeKatex, { strict: "ignore" }]]}
        components={{
          h1: ({ children }) => <h1 className="mt-4 text-xl font-extrabold text-[#101828] first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-4 text-lg font-bold text-[#101828] first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-3 text-base font-bold text-[#101828] first:mt-0">{children}</h3>,
          p: ({ children }) => {
            const childNodes = React.Children.toArray(children);
            const hasBlockChild = childNodes.some(
              (child) => React.isValidElement(child) && (child.type === "pre" || child.type === "table" || child.type === "div"),
            );
            if (hasBlockChild) {
              return <div className="mt-2 first:mt-0">{children}</div>;
            }
            return <p className="mt-2 first:mt-0">{children}</p>;
          },
          ul: ({ children }) => <ul className="mt-2 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mt-2 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-[inherit]">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="mt-3 rounded-r-2xl border-l-4 border-[#f3b5c9] bg-[#fff7fa] px-4 py-3 text-[#475467]">
              {children}
            </blockquote>
          ),
          code: ({ inline, className: codeClassName, children, ...props }: React.HTMLAttributes<HTMLElement> & { inline?: boolean }) =>
            inline ? (
              <code className="rounded bg-black/8 px-1.5 py-0.5 text-[0.92em]" {...props}>
                {children}
              </code>
            ) : (
              <code className={codeClassName} {...props}>
                {children}
              </code>
            ),
          pre: ({ children }) => (
            <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#111827] p-4 text-[13px] leading-6 text-white">{children}</pre>
          ),
          table: ({ children }) => (
            <div className="mt-3 overflow-x-auto rounded-2xl border border-[#E7ECF0]">
              <table className="min-w-full border-collapse bg-white text-left text-[13px]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[#F8FAFC]">{children}</thead>,
          th: ({ children }) => <th className="border-b border-[#E7ECF0] px-3 py-2 font-bold text-[#344054]">{children}</th>,
          td: ({ children }) => <td className="border-b border-[#EEF2F6] px-3 py-2 text-[#475467]">{children}</td>,
          hr: () => <hr className="my-4 border-[#E7ECF0]" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer" className="font-semibold text-[#E85D8E] underline underline-offset-2">
              {children}
            </a>
          ),
        }}
      >
        {normalizedContent}
      </ReactMarkdown>
    </div>
  );
}
