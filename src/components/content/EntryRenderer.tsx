
import type { ReactNode } from 'react';

import {
  renderStructuredEntries
} from '../../engine/entryRenderer';

import type {
  InlineNode,
  RenderBlock
} from '../../engine/entryRenderer';

// ==========================================
// TYPES
// ==========================================

interface EntryRendererProps {
  entries: unknown;
  maxDepth?: number;
  includeTitles?: boolean;
  className?: string;
}

interface BlockRendererProps {
  blocks: RenderBlock[];
}

// ==========================================
// RENDU DES TEXTES ENRICHIS
// ==========================================

function renderInlineNodes(
  nodes: InlineNode[]
): ReactNode {
  return nodes.map((node, index) => {
    const key = index;

    switch (node.type) {
      case 'text':
        return node.text;

      case 'bold':
        return (
          <strong key={key}>
            {renderInlineNodes(node.children)}
          </strong>
        );

      case 'italic':
        return (
          <em key={key}>
            {renderInlineNodes(node.children)}
          </em>
        );

      case 'underline':
        return (
          <u key={key}>
            {renderInlineNodes(node.children)}
          </u>
        );

      case 'strike':
        return (
          <s key={key}>
            {renderInlineNodes(node.children)}
          </s>
        );
    }
  });
}

// ==========================================
// TITRES
// ==========================================

function renderHeading(
  content: InlineNode[],
  level: number,
  key: number
): ReactNode {
  const children = renderInlineNodes(content);

  switch (level) {
    case 1:
      return <h1 key={key}>{children}</h1>;

    case 2:
      return <h2 key={key}>{children}</h2>;

    case 3:
      return <h3 key={key}>{children}</h3>;

    case 4:
      return <h4 key={key}>{children}</h4>;

    case 5:
      return <h5 key={key}>{children}</h5>;

    default:
      return <h6 key={key}>{children}</h6>;
  }
}

// ==========================================
// TABLEAUX
// ==========================================

function renderTable(
  block: Extract<
    RenderBlock,
    { type: 'table' }
  >,
  key: number
): ReactNode {
  return (
    <div
      key={key}
      className="entry-renderer-table-wrapper"
      style={{
        overflowX: 'auto',
        margin: '12px 0'
      }}
    >
      <table
        className="entry-renderer-table"
        style={{
          width: '100%',
          borderCollapse: 'collapse'
        }}
      >
        {block.caption && (
          <caption
            style={{
              padding: '8px',
              fontWeight: 600,
              textAlign: 'left'
            }}
          >
            {renderInlineNodes(block.caption)}
          </caption>
        )}

        {block.headers.length > 0 && (
          <thead>
            <tr>
              {block.headers.map(
                (header, index) => (
                  <th
                    key={index}
                    scope="col"
                    style={{
                      padding: '8px',
                      textAlign: 'left',
                      borderBottom:
                        '1px solid currentColor'
                    }}
                  >
                    {renderInlineNodes(header)}
                  </th>
                )
              )}
            </tr>
          </thead>
        )}

        <tbody>
          {block.rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {row.map((cell, cellIndex) => (
                <td
                  key={cellIndex}
                  style={{
                    padding: '8px',
                    borderBottom:
                      '1px solid rgba(128,128,128,0.25)',
                    verticalAlign: 'top'
                  }}
                >
                  {renderInlineNodes(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ==========================================
// LISTES
// ==========================================

function renderList(
  block: Extract<
    RenderBlock,
    { type: 'list' }
  >,
  key: number
): ReactNode {
  const items = block.items.map(
    (item, index) => (
      <li key={index}>
        <BlockRenderer blocks={item} />
      </li>
    )
  );

  if (block.ordered) {
    return (
      <ol key={key} className="entry-renderer-list">
        {items}
      </ol>
    );
  }

  return (
    <ul key={key} className="entry-renderer-list">
      {items}
    </ul>
  );
}

// ==========================================
// RENDU DES BLOCS
// ==========================================

function renderBlock(
  block: RenderBlock,
  key: number
): ReactNode {
  switch (block.type) {
    case 'paragraph':
      return (
        <p key={key}>
          {renderInlineNodes(block.content)}
        </p>
      );

    case 'heading':
      return renderHeading(
        block.content,
        block.level ?? 3,
        key
      );

    case 'list':
      return renderList(block, key);

    case 'table':
      return renderTable(block, key);

    case 'quote':
      return (
        <blockquote
          key={key}
          className="entry-renderer-quote"
          style={{
            borderLeft:
              '3px solid currentColor',
            paddingLeft: '16px',
            margin: '12px 0',
            opacity: 0.85
          }}
        >
          <BlockRenderer blocks={block.blocks} />
        </blockquote>
      );

    case 'group':
      return (
        <section
          key={key}
          className="entry-renderer-group"
          style={{
            margin: '12px 0'
          }}
        >
          {block.title && (
            <h4>
              {renderInlineNodes(block.title)}
            </h4>
          )}

          <BlockRenderer blocks={block.blocks} />
        </section>
      );
  }
}

// ==========================================
// RENDU D'UNE COLLECTION
// ==========================================

function BlockRenderer({
  blocks
}: BlockRendererProps) {
  return (
    <>
      {blocks.map((block, index) =>
        renderBlock(block, index)
      )}
    </>
  );
}

// ==========================================
// COMPOSANT PRINCIPAL
// ==========================================

export default function EntryRenderer({
  entries,
  maxDepth,
  includeTitles = true,
  className = ''
}: EntryRendererProps) {
  const blocks = renderStructuredEntries(
    entries,
    {
      maxDepth,
      includeTitles
    }
  );

  if (blocks.length === 0) {
    return null;
  }

  return (
    <div
      className={[
        'entry-renderer',
        className
      ].filter(Boolean).join(' ')}
      style={{
        lineHeight: 1.65,
        overflowWrap: 'anywhere'
      }}
    >
      <BlockRenderer blocks={blocks} />
    </div>
  );
}
