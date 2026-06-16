import ReactMarkdown from "react-markdown";

interface MarkdownRendererProps {
  children: string;
  className?: string;
}

/**
 * Lightweight markdown renderer using react-markdown.
 * Replaces the heavy streamdown package (which bundles Mermaid, Shiki, Cytoscape etc.)
 * for simple AI response rendering.
 */
export function MarkdownRenderer({ children, className }: MarkdownRendererProps) {
  return (
    <div className={`prose prose-sm dark:prose-invert max-w-none ${className ?? ""}`}>
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
