"use client";

/**
 * Renders a daily report's markdown (headings, one table, paragraphs, hr,
 * emphasis; the exact subset the generator emits). No external markdown
 * dependency, no HTML injection: everything is built as React nodes.
 */
import type { ReactNode } from "react";
import { Fragment } from "react";

function inline(text: string, key: number): ReactNode {
  // Only *emphasis* spans occur in generated reports.
  const parts = text.split(/(\*[^*]+\*)/g);
  return (
    <Fragment key={key}>
      {parts.map((p, i) =>
        p.startsWith("*") && p.endsWith("*") && p.length > 2 ? (
          <em key={i}>{p.slice(1, -1)}</em>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        )
      )}
    </Fragment>
  );
}

export function ReportView({ markdown }: { markdown: string }) {
  const lines = markdown.split("\n");
  const nodes: ReactNode[] = [];
  let tableBuffer: string[] = [];
  let key = 0;

  const flushTable = () => {
    if (tableBuffer.length < 2) {
      tableBuffer = [];
      return;
    }
    const [headerLine, ...rows] = tableBuffer;
    const headers = headerLine!.split("|").map((c) => c.trim()).filter(Boolean);
    const bodyRows = rows
      .filter((r) => !/^\|?[\s|-]+\|?$/.test(r))
      .map((r) => r.split("|").map((c) => c.trim()).filter(Boolean));
    nodes.push(
      <div key={key++} className="overflow-x-auto thin-scroll">
        <table>
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {bodyRows.map((cells, ri) => (
              <tr key={ri}>
                {cells.map((c, ci) => (
                  <td key={ci}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableBuffer = [];
  };

  for (const line of lines) {
    if (line.startsWith("|")) {
      tableBuffer.push(line);
      continue;
    }
    flushTable();
    if (line.startsWith("# ")) nodes.push(<h1 key={key++}>{line.slice(2)}</h1>);
    else if (line.startsWith("## ")) nodes.push(<h2 key={key++}>{line.slice(3)}</h2>);
    else if (line.trim() === "---") nodes.push(<hr key={key++} />);
    else if (line.trim() !== "") nodes.push(<p key={key++}>{inline(line, key)}</p>);
  }
  flushTable();

  return <div className="report-md">{nodes}</div>;
}
