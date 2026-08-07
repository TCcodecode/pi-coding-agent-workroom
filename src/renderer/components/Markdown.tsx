import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Renders assistant/user markdown content. Links open in the system browser. */
export function Markdown({ content }: { content: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              onClick={(event) => {
                event.preventDefault();
                void window.pi?.openExternal?.(href ?? "");
              }}
            >
              {children}
            </a>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
