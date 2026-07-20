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

interface MindmapNode {
  id: string;
  label: string;
  children: MindmapNode[];
}

function getNodeText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) return getNodeText(node.props.children);
  return "";
}

function cleanMindmapLabel(rawLabel: string) {
  const withoutIcon = rawLabel.replace(/::icon\([^)]+\)/g, "").trim();
  const wrapped = withoutIcon.match(/^[\w-]*\(\((.+)\)\)$/) || withoutIcon.match(/^[\w-]*\((.+)\)$/);
  return (wrapped?.[1] || withoutIcon).replace(/^["']|["']$/g, "").trim();
}

function parseMermaidMindmap(source: string): MindmapNode[] {
  const rows = source
    .replace(/^```mermaid/i, "")
    .replace(/```$/i, "")
    .split(/\r?\n/)
    .map((line) => ({ indent: line.match(/^\s*/)?.[0].length || 0, text: line.trim() }))
    .filter((line) => line.text && !/^mindmap$/i.test(line.text));

  const roots: MindmapNode[] = [];
  const stack: Array<{ level: number; node: MindmapNode }> = [];

  rows.forEach((row, index) => {
    const level = Math.max(0, Math.floor(row.indent / 2));
    const node: MindmapNode = {
      id: `mindmap-node-${index}`,
      label: cleanMindmapLabel(row.text),
      children: [],
    };

    while (stack.length && stack[stack.length - 1].level >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1]?.node;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }

    stack.push({ level, node });
  });

  return roots;
}

function MindmapBranch({ node, depth = 0 }: { node: MindmapNode; depth?: number }) {
  const tones = [
    "border-[#b7d8f0] bg-[#f7fbff] text-[#0f3f5f]",
    "border-[#d4e6f4] bg-white text-[#1f2937]",
    "border-[#eef2f7] bg-[#fbfdff] text-[#475569]",
  ];
  const tone = tones[Math.min(depth, tones.length - 1)];

  return (
    <li className="relative pl-5 before:absolute before:left-0 before:top-4 before:h-px before:w-4 before:bg-[#c9d7e6]">
      <div className={`rounded-2xl border px-3 py-2 text-[13px] font-bold leading-6 shadow-[0_8px_22px_rgba(15,23,42,0.04)] ${tone}`}>
        {node.label}
      </div>
      {node.children.length ? (
        <ul className="mt-2 space-y-2 border-l border-[#d9e5f0] pl-3">
          {node.children.map((child) => (
            <MindmapBranch key={child.id} node={child} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function MermaidMindmapPreview({ source }: { source: string }) {
  const nodes = parseMermaidMindmap(source);
  if (!nodes.length) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-[24px] border border-[#d4e6f4] bg-[linear-gradient(135deg,#ffffff_0%,#f3f9ff_100%)] p-4 shadow-[0_16px_36px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-[#e3edf7] pb-3">
        <div>
          <div className="text-[10px] font-black tracking-[0.18em] text-[#006689]">MINDMAP</div>
          <div className="mt-1 text-base font-black text-[#111827]">知识结构导图</div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-[#006689] ring-1 ring-[#d4e6f4]">
          {nodes.length} 条主线
        </span>
      </div>
      <ul className="space-y-3">
        {nodes.map((node) => (
          <MindmapBranch key={node.id} node={node} />
        ))}
      </ul>
    </div>
  );
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
          blockquote: ({ children }) => <div className="mt-2 text-[#475467]">{children}</div>,
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
          pre: ({ children }) => {
            const child = React.Children.toArray(children).find(React.isValidElement);
            const codeClassName = React.isValidElement<{ className?: string }>(child) ? child.props.className || "" : "";
            const codeText = getNodeText(child || children).trim();
            if ((codeClassName.includes("language-mermaid") || /^mindmap\b/i.test(codeText)) && /\bmindmap\b/i.test(codeText)) {
              return <MermaidMindmapPreview source={codeText} />;
            }
            return <pre className="mt-3 overflow-x-auto rounded-2xl bg-[#111827] p-4 text-[13px] leading-6 text-white">{children}</pre>;
          },
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
