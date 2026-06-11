import katex from "katex";

export function MathText({ children }: { children: string }) {
  const parts = children.split(/(\$[^$]+\$)/g).filter(Boolean);
  return (
    <span>
      {parts.map((part, index) =>
        part.startsWith("$") && part.endsWith("$") ? (
          <span
            key={`${part}-${index}`}
            dangerouslySetInnerHTML={{
              __html: katex.renderToString(part.slice(1, -1), {
                throwOnError: false,
                output: "html",
              }),
            }}
          />
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        ),
      )}
    </span>
  );
}
