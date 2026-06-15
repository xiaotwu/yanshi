import { Fragment, type ReactNode } from "react";

/**
 * Minimal, dependency-free, injection-safe Markdown renderer for assistant answers. Builds React
 * elements directly (never dangerouslySetInnerHTML), covering the subset models actually emit:
 * headings, bold/italic, inline code, fenced code blocks, ordered/unordered lists, links, and
 * paragraphs. Unknown syntax falls through as plain text — never throws, never injects HTML.
 */

type Block =
  | { kind: "code"; lang: string; text: string }
  | { kind: "heading"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[] }
  | { kind: "p"; text: string };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, "\n").split("\n");
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Fenced code block.
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      const lang = fence[1] ?? "";
      const body: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // skip closing fence
      blocks.push({ kind: "code", lang, text: body.join("\n") });
      continue;
    }
    // Heading.
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }
    // Unordered list.
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ul", items });
      continue;
    }
    // Ordered list.
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+[.)]\s+/, ""));
        i++;
      }
      blocks.push({ kind: "ol", items });
      continue;
    }
    // Blank line.
    if (line.trim() === "") {
      i++;
      continue;
    }
    // Paragraph: gather until blank line or a block starter.
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !/^```/.test(lines[i]) &&
      !/^#{1,6}\s+/.test(lines[i]) &&
      !/^\s*[-*+]\s+/.test(lines[i]) &&
      !/^\s*\d+[.)]\s+/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    blocks.push({ kind: "p", text: para.join("\n") });
  }
  return blocks;
}

/** Inline parser: bold, italic, inline code, and links. Returns React nodes. */
function renderInline(text: string, keyBase: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  // Order matters: code first (so its contents aren't re-parsed), then links, then bold, italic.
  // Built via RegExp(string) because a literal containing a backtick confuses the TSX lexer.
  const pattern = new RegExp(
    "(`[^`]+`)|(\\[[^\\]]+\\]\\([^)\\s]+\\))|(\\*\\*[^*]+\\*\\*)|(\\*[^*]+\\*)|(_[^_]+_)",
  );
  let rest = text;
  let n = 0;
  while (rest.length > 0) {
    const match = pattern.exec(rest);
    if (!match) {
      nodes.push(<Fragment key={`${keyBase}-t${n}`}>{rest}</Fragment>);
      break;
    }
    if (match.index > 0) {
      nodes.push(<Fragment key={`${keyBase}-t${n}`}>{rest.slice(0, match.index)}</Fragment>);
      n++;
    }
    const token = match[0];
    const key = `${keyBase}-m${n}`;
    if (token.startsWith("`")) {
      nodes.push(<code key={key} className="md-code">{token.slice(1, -1)}</code>);
    } else if (token.startsWith("[")) {
      const link = token.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
      if (link) {
        nodes.push(
          <a key={key} href={link[2]} target="_blank" rel="noreferrer">
            {link[1]}
          </a>,
        );
      } else {
        nodes.push(<Fragment key={key}>{token}</Fragment>);
      }
    } else if (token.startsWith("**")) {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key}>{token.slice(1, -1)}</em>);
    }
    n++;
    rest = rest.slice(match.index + token.length);
  }
  return nodes;
}

export function Markdown({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="md">
      {blocks.map((block, index) => {
        const key = `b${index}`;
        switch (block.kind) {
          case "code":
            return (
              <pre key={key} className="md-pre">
                <code>{block.text}</code>
              </pre>
            );
          case "heading": {
            const Tag = (`h${Math.min(block.level + 2, 6)}`) as "h3" | "h4" | "h5" | "h6";
            return <Tag key={key} className="md-h">{renderInline(block.text, key)}</Tag>;
          }
          case "ul":
            return (
              <ul key={key} className="md-list">
                {block.items.map((item, idx) => (
                  <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol key={key} className="md-list">
                {block.items.map((item, idx) => (
                  <li key={`${key}-${idx}`}>{renderInline(item, `${key}-${idx}`)}</li>
                ))}
              </ol>
            );
          default:
            return (
              <p key={key} className="md-p">
                {renderInline(block.text, key)}
              </p>
            );
        }
      })}
    </div>
  );
}
