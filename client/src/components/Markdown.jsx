import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Renders trusted, author-supplied markdown (domain-question prompts, model
// answers, MCQ explanations). react-markdown escapes HTML by default, so this
// is safe without a separate sanitiser. Styling is done with explicit element
// overrides rather than a typography plugin to stay on the app's tokens.
const components = {
  p: (props) => <p className="mb-3 last:mb-0 leading-relaxed" {...props} />,
  ul: (props) => <ul className="mb-3 list-disc space-y-1 pl-5" {...props} />,
  ol: (props) => <ol className="mb-3 list-decimal space-y-1 pl-5" {...props} />,
  li: (props) => <li className="leading-relaxed" {...props} />,
  h1: (props) => <h1 className="mb-2 mt-4 text-lg font-bold text-primary first:mt-0" {...props} />,
  h2: (props) => <h2 className="mb-2 mt-4 text-base font-bold text-primary first:mt-0" {...props} />,
  h3: (props) => <h3 className="mb-1.5 mt-3 text-sm font-bold text-primary first:mt-0" {...props} />,
  a: (props) => (
    <a className="font-medium text-accent underline underline-offset-2 hover:opacity-80" target="_blank" rel="noopener noreferrer" {...props} />
  ),
  strong: (props) => <strong className="font-bold text-primary" {...props} />,
  em: (props) => <em className="italic" {...props} />,
  blockquote: (props) => (
    <blockquote className="my-3 border-l-2 border-accent/40 pl-3 italic text-tertiary" {...props} />
  ),
  hr: () => <hr className="my-4 border-subtle" />,
  table: (props) => (
    <div className="my-3 overflow-x-auto">
      <table className="w-full border-collapse text-left text-[13px]" {...props} />
    </div>
  ),
  th: (props) => <th className="border border-subtle px-2 py-1 font-semibold" {...props} />,
  td: (props) => <td className="border border-subtle px-2 py-1" {...props} />,
  code: ({ inline, className, children, ...props }) =>
    inline ? (
      <code className="rounded bg-black/10 px-1.5 py-0.5 font-mono text-[0.85em] text-primary dark:bg-white/10" {...props}>
        {children}
      </code>
    ) : (
      <code className={`font-mono text-[0.85em] ${className || ""}`} {...props}>
        {children}
      </code>
    ),
  pre: (props) => (
    <pre className="my-3 overflow-x-auto rounded-xl border border-subtle bg-black/[0.06] p-3 text-[0.85em] leading-relaxed dark:bg-white/[0.04]" {...props} />
  ),
};

const Markdown = ({ children, className = "" }) => (
  <div className={`text-secondary ${className}`}>
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
      {children || ""}
    </ReactMarkdown>
  </div>
);

export default Markdown;
