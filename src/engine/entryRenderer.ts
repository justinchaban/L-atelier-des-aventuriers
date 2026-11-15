
import { isJsonRecord } from './contentImporter';
import type { JsonRecord } from './contentImporter';

// ==========================================
// TYPES
// ==========================================

export interface RenderOptions {
  maxDepth?: number;
  includeTitles?: boolean;
}

export type InlineNode =
  | { type: 'text'; text: string }
  | {
      type: 'bold' | 'italic' | 'underline' | 'strike';
      children: InlineNode[];
    };

export interface TextBlock {
  type: 'paragraph' | 'heading';
  content: InlineNode[];
  level?: number;
}

export interface ListBlock {
  type: 'list';
  ordered: boolean;
  items: RenderBlock[][];
}

export interface TableBlock {
  type: 'table';
  caption?: InlineNode[];
  headers: InlineNode[][];
  rows: InlineNode[][][];
}

export interface QuoteBlock {
  type: 'quote';
  blocks: RenderBlock[];
}

export interface GroupBlock {
  type: 'group';
  title?: InlineNode[];
  blocks: RenderBlock[];
}

export type RenderBlock =
  | TextBlock
  | ListBlock
  | TableBlock
  | QuoteBlock
  | GroupBlock;

interface RenderContext {
  depth: number;
  maxDepth: number;
  includeTitles: boolean;
}

// ==========================================
// CONSTANTES
// ==========================================

const DEFAULT_MAX_DEPTH = 20;
const MAX_INLINE_DEPTH = 20;

// ==========================================
// UTILITAIRES
// ==========================================

function getString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed || null;
}

function normalizeText(text: string): string {
  return text
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function nextContext(context: RenderContext): RenderContext {
  return {
    ...context,
    depth: context.depth + 1
  };
}

function textNode(text: string): InlineNode {
  return { type: 'text', text };
}

function paragraph(content: InlineNode[]): TextBlock {
  return { type: 'paragraph', content };
}

function heading(
  content: InlineNode[],
  level = 3
): TextBlock {
  return {
    type: 'heading',
    content,
    level: Math.max(1, Math.min(level, 6))
  };
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

// ==========================================
// BALISES INLINE 5E.TOOLS
// ==========================================

function findTagEnd(
  text: string,
  start: number
): number {
  let depth = 0;

  for (let index = start; index < text.length; index++) {
    if (
      text[index] === '{' &&
      text[index + 1] === '@'
    ) {
      depth++;
      index++;
      continue;
    }

    if (text[index] === '}') {
      depth--;

      if (depth === 0) {
        return index;
      }
    }
  }

  return -1;
}

function splitTag(
  raw: string
): { name: string; content: string } | null {
  const match = /^([a-zA-Z0-9]+)(?:\s+([\s\S]*))?$/.exec(raw);

  if (!match) {
    return null;
  }

  return {
    name: match[1].toLowerCase(),
    content: match[2] ?? ''
  };
}

function getTagDisplayText(
  name: string,
  content: string
): string {
  const parts = content.split('|');

  switch (name) {
    case 'filter':
    case 'link':
      return parts[0] ?? '';

    case 'spell':
    case 'item':
    case 'creature':
    case 'condition':
    case 'skill':
    case 'sense':
    case 'action':
    case 'feat':
    case 'class':
    case 'subclass':
    case 'background':
    case 'race':
    case 'book':
      return parts[2] || parts[0] || '';

    case 'dc':
      return `DD ${parts[0] ?? ''}`;

    case 'h':
      return 'Touché :';

    case 'dice':
    case 'damage':
    case 'd20':
    case 'hit':
    case 'chance':
    case 'recharge':
    case 'atk':
      return parts[0] ?? '';

    default:
      return parts[0] ?? '';
  }
}

function parseTag(
  name: string,
  content: string,
  depth: number
): InlineNode[] {
  const formatting: Record<
    string,
    'bold' | 'italic' | 'underline' | 'strike'
  > = {
    b: 'bold',
    bold: 'bold',
    i: 'italic',
    italic: 'italic',
    u: 'underline',
    underline: 'underline',
    s: 'strike',
    strike: 'strike'
  };

  const style = formatting[name];

  if (style) {
    return [{
      type: style,
      children: parseInline(
        content.split('|')[0] ?? '',
        depth + 1
      )
    }];
  }

  const display = getTagDisplayText(name, content);

  return parseInline(display, depth + 1);
}

export function parseInline(
  text: string,
  depth = 0
): InlineNode[] {
  if (depth > MAX_INLINE_DEPTH) {
    return [textNode(text)];
  }

  const nodes: InlineNode[] = [];
  let position = 0;

  while (position < text.length) {
    const start = text.indexOf('{@', position);

    if (start === -1) {
      nodes.push(textNode(text.slice(position)));
      break;
    }

    if (start > position) {
      nodes.push(
        textNode(text.slice(position, start))
      );
    }

    const end = findTagEnd(text, start);

    if (end === -1) {
      nodes.push(textNode(text.slice(start)));
      break;
    }

    const tag = splitTag(
      text.slice(start + 2, end)
    );

    if (tag) {
      nodes.push(
        ...parseTag(
          tag.name,
          tag.content,
          depth + 1
        )
      );
    } else {
      nodes.push(
        textNode(text.slice(start, end + 1))
      );
    }

    position = end + 1;
  }

  return nodes;
}

// ==========================================
// CONVERSION INLINE EN TEXTE
// ==========================================

export function inlineToText(
  nodes: InlineNode[]
): string {
  return nodes.map(node => {
    if (node.type === 'text') {
      return node.text;
    }

    return inlineToText(node.children);
  }).join('');
}

export function renderInlineText(
  text: string
): string {
  return inlineToText(parseInline(text));
}

// ==========================================
// CONVERSION DES TABLEAUX
// ==========================================

function parseTableCell(
  value: unknown,
  context: RenderContext
): InlineNode[] {
  if (typeof value === 'string') {
    return parseInline(value);
  }

  if (typeof value === 'number') {
    return [textNode(String(value))];
  }

  if (isJsonRecord(value)) {
    if (typeof value.roll === 'string') {
      return parseInline(value.roll);
    }

    if (isJsonRecord(value.roll)) {
      const roll = value.roll;
      const exact = roll.exact;
      const min = roll.min;
      const max = roll.max;

      if (typeof exact === 'number') {
        return [textNode(String(exact))];
      }

      if (
        typeof min === 'number' &&
        typeof max === 'number'
      ) {
        return [
          textNode(`${min}–${max}`)
        ];
      }
    }

    const blocks = parseBlocks(
      value,
      nextContext(context)
    );

    return [
      textNode(blocksToText(blocks))
    ];
  }

  if (Array.isArray(value)) {
    return [
      textNode(
        blocksToText(
          parseBlocks(value, nextContext(context))
        )
      )
    ];
  }

  return [];
}

function parseTable(
  entry: JsonRecord,
  context: RenderContext
): TableBlock {
  const caption = getString(entry.caption);

  const headers = asArray(entry.colLabels)
    .map(value =>
      parseTableCell(value, context)
    );

  const rows: InlineNode[][][] = [];

  for (const row of asArray(entry.rows)) {
    if (!Array.isArray(row)) {
      continue;
    }

    rows.push(
      row.map(cell =>
        parseTableCell(cell, context)
      )
    );
  }

  return {
    type: 'table',
    caption:
      caption && context.includeTitles
        ? parseInline(caption)
        : undefined,
    headers,
    rows
  };
}

// ==========================================
// CONVERSION DES LISTES
// ==========================================

function parseList(
  entry: JsonRecord,
  context: RenderContext
): ListBlock {
  const ordered =
    entry.style === 'list-decimal';

  const items = asArray(entry.items)
    .map(item =>
      parseBlocks(item, nextContext(context))
    );

  return {
    type: 'list',
    ordered,
    items
  };
}

// ==========================================
// ENTRÉES NOMMÉES
// ==========================================

function parseNamedEntry(
  entry: JsonRecord,
  context: RenderContext
): RenderBlock[] {
  const blocks: RenderBlock[] = [];
  const name = getString(entry.name);

  if (name && context.includeTitles) {
    blocks.push(
      heading(
        parseInline(name),
        Math.min(2 + context.depth, 6)
      )
    );
  }

  blocks.push(
    ...parseBlocks(
      entry.entries,
      nextContext(context)
    )
  );

  return blocks;
}

// ==========================================
// OBJETS STRUCTURÉS
// ==========================================

function parseObject(
  entry: JsonRecord,
  context: RenderContext
): RenderBlock[] {
  const type = getString(entry.type);

  switch (type) {
    case 'entries':
    case 'section':
    case 'inset':
    case 'insetReadaloud':
      return parseNamedEntry(entry, context);

    case 'list':
      return [parseList(entry, context)];

    case 'table':
      return [parseTable(entry, context)];

    case 'item': {
      const name = getString(entry.name);
      const body = entry.entries ?? entry.entry;

      const blocks = parseBlocks(
        body,
        nextContext(context)
      );

      if (!name) {
        return blocks;
      }

      return [{
        type: 'group',
        title: parseInline(name),
        blocks
      }];
    }

    case 'quote':
      return [{
        type: 'quote',
        blocks: parseBlocks(
          entry.entries,
          nextContext(context)
        )
      }];

    case 'options':
      return parseBlocks(
        entry.entries,
        nextContext(context)
      );

    default:
      if (Array.isArray(entry.entries)) {
        return parseNamedEntry(entry, context);
      }

      if (entry.entry !== undefined) {
        return parseBlocks(
          entry.entry,
          nextContext(context)
        );
      }

      if (typeof entry.name === 'string') {
        return [
          paragraph(parseInline(entry.name))
        ];
      }

      return [];
  }
}

// ==========================================
// MOTEUR PRINCIPAL
// ==========================================

function parseBlocks(
  value: unknown,
  context: RenderContext
): RenderBlock[] {
  if (context.depth > context.maxDepth) {
    return [
      paragraph([
        textNode(
          '[Contenu imbriqué trop profondément]'
        )
      ])
    ];
  }

  if (typeof value === 'string') {
    return [
      paragraph(parseInline(value))
    ];
  }

  if (typeof value === 'number') {
    return [
      paragraph([
        textNode(String(value))
      ])
    ];
  }

  if (Array.isArray(value)) {
    return value.flatMap(item =>
      parseBlocks(
        item,
        nextContext(context)
      )
    );
  }

  if (isJsonRecord(value)) {
    return parseObject(value, context);
  }

  return [];
}

// ==========================================
// API STRUCTURÉE
// ==========================================

export function renderStructuredEntries(
  entries: unknown,
  options: RenderOptions = {}
): RenderBlock[] {
  const context: RenderContext = {
    depth: 0,
    maxDepth:
      options.maxDepth ?? DEFAULT_MAX_DEPTH,
    includeTitles:
      options.includeTitles ?? true
  };

  return parseBlocks(entries, context);
}

// ==========================================
// CONVERSION EN TEXTE BRUT
// ==========================================

function blocksToText(
  blocks: RenderBlock[],
  depth = 0
): string {
  const indent = '  '.repeat(
    Math.min(depth, 10)
  );

  return blocks.map(block => {
    switch (block.type) {
      case 'paragraph':
      case 'heading':
        return inlineToText(block.content);

      case 'group': {
        const title = block.title
          ? inlineToText(block.title)
          : '';

        const body = blocksToText(
          block.blocks,
          depth + 1
        );

        return [title, body]
          .filter(Boolean)
          .join('\n\n');
      }

      case 'quote':
        return blocksToText(
          block.blocks,
          depth + 1
        )
          .split('\n')
          .map(line => `> ${line}`)
          .join('\n');

      case 'list':
        return block.items.map(
          (item, index) => {
            const marker = block.ordered
              ? `${index + 1}.`
              : '-';

            const content = blocksToText(
              item,
              depth + 1
            ).replace(/\n/g, '\n' + indent + '  ');

            return `${indent}${marker} ${content}`;
          }
        ).join('\n');

      case 'table': {
        const lines: string[] = [];

        if (block.caption) {
          lines.push(
            inlineToText(block.caption)
          );
        }

        if (block.headers.length > 0) {
          lines.push(
            block.headers
              .map(inlineToText)
              .join(' | ')
          );

          lines.push(
            block.headers
              .map(() => '---')
              .join(' | ')
          );
        }

        for (const row of block.rows) {
          lines.push(
            row.map(inlineToText).join(' | ')
          );
        }

        return lines.join('\n');
      }
    }
  }).join('\n\n');
}

// ==========================================
// API TEXTE BRUT
// ==========================================

export function renderEntries(
  entries: unknown,
  options: RenderOptions = {}
): string {
  return normalizeText(
    blocksToText(
      renderStructuredEntries(entries, options)
    )
  );
}

export function renderEntryPreview(
  entries: unknown,
  maxLength = 300
): string {
  const text = renderEntries(entries);

  if (
    maxLength <= 0 ||
    text.length <= maxLength
  ) {
    return text;
  }

  return (
    text.slice(0, maxLength).trimEnd() +
    '…'
  );
}
