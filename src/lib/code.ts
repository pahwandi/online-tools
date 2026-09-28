export type CodeLanguage = 'html' | 'css' | 'js';
export type CodeMode = 'minify' | 'format';

/* ============================ CSS ============================ */

type CssChunk = { kind: 'code' | 'string' | 'comment'; text: string };

function scanCss(src: string): CssChunk[] {
  const chunks: CssChunk[] = [];
  let buf = '';
  let i = 0;
  const flush = () => {
    if (buf) {
      chunks.push({ kind: 'code', text: buf });
      buf = '';
    }
  };
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '*') {
      flush();
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? src.length : j + 2;
      chunks.push({ kind: 'comment', text: src.slice(i, j) });
      i = j;
    } else if (c === '"' || c === "'") {
      flush();
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === c) {
          j++;
          break;
        }
        j++;
      }
      chunks.push({ kind: 'string', text: src.slice(i, Math.min(j, src.length)) });
      i = j;
    } else {
      buf += c;
      i++;
    }
  }
  flush();
  return chunks;
}

// Punctuation that spaces can safely be stripped around.
// NOTE: + - * / % are excluded — calc() needs spaces around them.
const CSS_PUNCT_RE = / ?([{};:,>()[\]~!]) ?/g;

export function minifyCss(src: string): string {
  let out = '';
  for (const chunk of scanCss(src)) {
    if (chunk.kind === 'comment') continue;
    if (chunk.kind === 'string') {
      out += chunk.text;
      continue;
    }
    out += chunk.text.replace(/\s+/g, ' ').replace(CSS_PUNCT_RE, '$1');
  }
  // Drop trailing semicolons before `}` (strings stay protected by re-scanning).
  let cleaned = '';
  for (const chunk of scanCss(out)) {
    cleaned += chunk.kind === 'code' ? chunk.text.replace(/;+\}/g, '}') : chunk.text;
  }
  return cleaned.trim();
}

export function formatCss(src: string, indentSize = 2): string {
  let out = '';
  let line = '';
  let depth = 0;
  let paren = 0;
  const pad = () => ' '.repeat(Math.max(0, depth) * indentSize);
  const pushLine = () => {
    const t = line.trim();
    if (t) out += `${pad()}${t}\n`;
    line = '';
  };

  for (const chunk of scanCss(src)) {
    if (chunk.kind === 'comment') {
      if (line.trim()) line += ` ${chunk.text.replace(/\s+/g, ' ')}`;
      else {
        pushLine();
        out += `${pad()}${chunk.text}\n`;
      }
      continue;
    }
    if (chunk.kind === 'string') {
      line += chunk.text;
      continue;
    }
    for (const c of chunk.text) {
      if (/\s/.test(c)) {
        if (line && !line.endsWith(' ')) line += ' ';
        continue;
      }
      if (c === '{') {
        if (line.trim() && !line.endsWith(' ')) line += ' ';
        line += '{';
        pushLine();
        depth++;
      } else if (c === '}') {
        pushLine();
        depth--;
        out += `${pad()}}\n`;
      } else if (c === ';') {
        line += ';';
        if (paren === 0) pushLine();
      } else if (c === '(') {
        paren++;
        line += '(';
      } else if (c === ')') {
        paren = Math.max(0, paren - 1);
        line += ')';
      } else {
        line += c;
      }
    }
  }
  pushLine();
  return out.trimEnd();
}

/* ============================ JS ============================ */

type JsChunk = {
  kind: 'code' | 'string' | 'template' | 'comment' | 'regex';
  text: string;
};

const REGEX_PREV_PUNCT = new Set([
  '(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';',
  '+', '-', '*', '%', '~', '^', '<', '>',
]);
const REGEX_PREV_WORDS = new Set([
  'return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete',
  'void', 'do', 'else', 'yield', 'await', 'case',
]);

const JS_OPERATORS = [
  '++', '--', '+=', '-=', '*=', '/=', '%=', '&=', '|=', '^=',
  '==', '===', '!=', '!==', '<=', '>=', '&&', '&&=', '||', '||=',
  '??', '??=', '=>', '<<', '<<=', '>>', '>>=', '>>>', '>>>=', '**', '**=', '...',
];

const isWordChar = (c: string): boolean => /[\w$]/.test(c);

function canJoinPunct(left: string, right: string): boolean {
  if (isWordChar(left) || isWordChar(right)) return false;
  const pair = left + right;
  if (pair === '//' || pair === '/*' || pair === '*/') return false;
  for (const op of JS_OPERATORS) {
    if (op.startsWith(pair)) return false;
  }
  return true;
}

function regexAllowed(prevChar: string, prevWord: string): boolean {
  if (!prevChar) return true;
  if (REGEX_PREV_PUNCT.has(prevChar)) return true;
  return REGEX_PREV_WORDS.has(prevWord);
}

/** Index just after the closing backtick of a template literal starting at `start`. */
function findTemplateEnd(src: string, start: number): number {
  let i = start + 1;
  let braceDepth = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '\\') {
      i += 2;
      continue;
    }
    if (braceDepth === 0) {
      if (c === '`') return i + 1;
      if (c === '$' && src[i + 1] === '{') {
        braceDepth++;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (c === '{') braceDepth++;
    else if (c === '}') braceDepth--;
    else if (c === '"' || c === "'") {
      const q = c;
      i++;
      while (i < src.length) {
        if (src[i] === '\\') {
          i += 2;
          continue;
        }
        if (src[i] === q) {
          i++;
          break;
        }
        i++;
      }
      continue;
    } else if (c === '`') {
      i = findTemplateEnd(src, i);
      continue;
    } else if (c === '/' && src[i + 1] === '/') {
      const nl = src.indexOf('\n', i);
      i = nl === -1 ? src.length : nl;
      continue;
    }
    i++;
  }
  return src.length;
}

function scanJs(src: string): JsChunk[] {
  const chunks: JsChunk[] = [];
  let buf = '';
  let prevChar = '';
  let prevWord = '';
  let wordPendingBreak = false;
  let i = 0;

  const flush = () => {
    if (buf) {
      chunks.push({ kind: 'code', text: buf });
      buf = '';
    }
  };

  while (i < src.length) {
    const c = src[i];

    if (c === '/' && src[i + 1] === '/') {
      flush();
      let j = src.indexOf('\n', i);
      if (j === -1) j = src.length;
      chunks.push({ kind: 'comment', text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (c === '/' && src[i + 1] === '*') {
      flush();
      let j = src.indexOf('*/', i + 2);
      j = j === -1 ? src.length : j + 2;
      chunks.push({ kind: 'comment', text: src.slice(i, j) });
      i = j;
      continue;
    }

    if (c === '"' || c === "'") {
      flush();
      let j = i + 1;
      while (j < src.length) {
        if (src[j] === '\\') {
          j += 2;
          continue;
        }
        if (src[j] === c) {
          j++;
          break;
        }
        j++;
      }
      chunks.push({ kind: 'string', text: src.slice(i, Math.min(j, src.length)) });
      prevChar = c;
      prevWord = '';
      i = j;
      continue;
    }

    if (c === '`') {
      flush();
      const end = findTemplateEnd(src, i);
      chunks.push({ kind: 'template', text: src.slice(i, end) });
      prevChar = '`';
      prevWord = '';
      i = end;
      continue;
    }

    if (c === '/' && regexAllowed(prevChar, prevWord)) {
      flush();
      let j = i + 1;
      let inClass = false;
      let closed = false;
      while (j < src.length) {
        const rc = src[j];
        if (rc === '\\') {
          j += 2;
          continue;
        }
        if (rc === '\n') break;
        if (rc === '[') inClass = true;
        else if (rc === ']') inClass = false;
        else if (rc === '/' && !inClass) {
          j++;
          closed = true;
          break;
        }
        j++;
      }
      if (closed) {
        while (j < src.length && /[a-z]/i.test(src[j])) j++;
        chunks.push({ kind: 'regex', text: src.slice(i, j) });
        prevChar = '/';
        prevWord = '';
        i = j;
        continue;
      }
      // Not a regex after all — treat as division.
      buf += '/';
      prevChar = '/';
      prevWord = '';
      i++;
      continue;
    }

    buf += c;
    if (/\s/.test(c)) {
      wordPendingBreak = true;
    } else {
      prevChar = c;
      if (isWordChar(c)) {
        prevWord = wordPendingBreak || !prevWord ? c : prevWord + c;
        wordPendingBreak = false;
      } else {
        prevWord = '';
        wordPendingBreak = false;
      }
    }
    i++;
  }
  flush();
  return chunks;
}

export function minifyJs(src: string): string {
  const chunks = scanJs(src);
  let out = '';

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];

    if (chunk.kind === 'comment') {
      // Keep a separating space when dropping a comment between word chars.
      const left = out[out.length - 1] ?? '';
      let right = '';
      for (let cj = ci + 1; cj < chunks.length && !right; cj++) {
        const nc = chunks[cj];
        if (nc.kind === 'comment') continue;
        right = (nc.kind === 'code' ? nc.text.replace(/^\s+/, '') : nc.text)[0] ?? '';
      }
      if (left && right && isWordChar(left) && isWordChar(right)) out += ' ';
      continue;
    }

    if (chunk.kind !== 'code') {
      out += chunk.text;
      continue;
    }

    const text = chunk.text.replace(/\s+/g, ' ');
    for (let k = 0; k < text.length; k++) {
      const c = text[k];
      if (c === ' ') {
        let right = '';
        for (let j = k + 1; j < text.length; j++) {
          if (text[j] !== ' ') {
            right = text[j];
            break;
          }
        }
        if (!right) {
          for (let cj = ci + 1; cj < chunks.length && !right; cj++) {
            const nc = chunks[cj];
            if (nc.kind === 'comment') continue;
            right = (nc.kind === 'code' ? nc.text.replace(/^\s+/, '') : nc.text)[0] ?? '';
          }
        }
        const left = out[out.length - 1] ?? '';
        if (!left || !right) continue;
        if (left === ' ') continue;
        if (canJoinPunct(left, right)) continue;
        out += ' ';
        continue;
      }
      out += c;
    }
  }
  return out.trim();
}

function nextJsToken(
  text: string,
  from: number,
  chunks: JsChunk[],
  chunkIndex: number,
): string {
  for (let k = from; k < text.length; k++) {
    const c = text[k];
    if (/\s/.test(c)) continue;
    if (isWordChar(c)) {
      let j = k + 1;
      while (j < text.length && isWordChar(text[j])) j++;
      return text.slice(k, j);
    }
    return c;
  }
  for (let cj = chunkIndex + 1; cj < chunks.length; cj++) {
    const nc = chunks[cj];
    if (nc.kind === 'comment') continue;
    if (nc.kind === 'code') return nextJsToken(nc.text, 0, chunks, cj);
    return nc.text[0] ?? '';
  }
  return '';
}

const CHAIN_AFTER_BRACE = new Set(['else', 'catch', 'finally', 'while']);

export function formatJs(src: string, indentSize = 2): string {
  const chunks = scanJs(src);
  let out = '';
  let line = '';
  let depth = 0;
  let paren = 0;
  const pad = () => ' '.repeat(Math.max(0, depth) * indentSize);
  const pushLine = () => {
    const t = line.trim();
    if (t) out += `${pad()}${t}\n`;
    line = '';
  };

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];

    if (chunk.kind === 'comment') {
      if (chunk.text.startsWith('//')) {
        if (line.trim()) line += ' ';
        line += chunk.text.trim();
        pushLine();
      } else if (line.trim()) {
        line += ` ${chunk.text.replace(/\s+/g, ' ')}`;
      } else {
        pushLine();
        out += `${pad()}${chunk.text}\n`;
      }
      continue;
    }

    if (chunk.kind !== 'code') {
      line += chunk.text;
      continue;
    }

    const text = chunk.text;
    for (let k = 0; k < text.length; k++) {
      const c = text[k];
      if (/\s/.test(c)) {
        if (line && !line.endsWith(' ')) line += ' ';
        continue;
      }
      if (c === '{') {
        if (line.trim() && !line.endsWith(' ')) line += ' ';
        line += '{';
        pushLine();
        depth++;
      } else if (c === '}') {
        pushLine();
        depth--;
        const next = nextJsToken(text, k + 1, chunks, ci);
        if (next && (CHAIN_AFTER_BRACE.has(next) || ')];,.'.includes(next))) {
          line = '}';
        } else {
          out += `${pad()}}\n`;
        }
      } else if (c === ';') {
        line += ';';
        if (paren === 0) pushLine();
      } else if (c === '(') {
        paren++;
        line += '(';
      } else if (c === ')') {
        paren = Math.max(0, paren - 1);
        line += ')';
      } else {
        line += c;
      }
    }
  }
  pushLine();
  return out.trimEnd();
}

/* ============================ HTML ============================ */

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
  'link', 'meta', 'param', 'source', 'track', 'wbr',
]);

const INLINE_TAGS = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'button', 'cite', 'code', 'data',
  'del', 'dfn', 'em', 'font', 'i', 'img', 'input', 'ins', 'kbd', 'label',
  'mark', 'q', 's', 'samp', 'select', 'small', 'span', 'strong', 'sub',
  'sup', 'textarea', 'time', 'u', 'var', 'wbr',
]);

const RAW_TAGS = new Set(['script', 'style', 'pre', 'textarea']);

type HtmlChunk =
  | { kind: 'text'; text: string }
  | { kind: 'comment'; text: string }
  | { kind: 'doctype'; text: string }
  | { kind: 'tag'; text: string; name: string; closing: boolean; selfClosing: boolean }
  | { kind: 'raw'; name: string; open: string; text: string; close: string };

const TAG_START = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)/y;

function scanHtml(src: string): HtmlChunk[] {
  const chunks: HtmlChunk[] = [];
  let textBuf = '';
  let i = 0;

  const flushText = () => {
    if (textBuf) {
      chunks.push({ kind: 'text', text: textBuf });
      textBuf = '';
    }
  };

  while (i < src.length) {
    const c = src[i];
    if (c !== '<') {
      textBuf += c;
      i++;
      continue;
    }
    if (src.startsWith('<!--', i)) {
      flushText();
      let j = src.indexOf('-->', i + 4);
      j = j === -1 ? src.length : j + 3;
      chunks.push({ kind: 'comment', text: src.slice(i, j) });
      i = j;
      continue;
    }
    if (src[i + 1] === '!' || src[i + 1] === '?') {
      flushText();
      let j = src.indexOf('>', i);
      j = j === -1 ? src.length : j + 1;
      chunks.push({ kind: 'doctype', text: src.slice(i, j) });
      i = j;
      continue;
    }
    TAG_START.lastIndex = i;
    const m = TAG_START.exec(src);
    if (!m) {
      textBuf += '<';
      i++;
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    let j = i + m[0].length;
    let quote = '';
    while (j < src.length) {
      const ch = src[j];
      if (quote) {
        if (ch === quote) quote = '';
      } else if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '>') {
        j++;
        break;
      }
      j++;
    }
    const tagText = src.slice(i, j);
    const selfClosing = tagText.endsWith('/>');
    flushText();
    i = j;

    if (!closing && !selfClosing && RAW_TAGS.has(name)) {
      const closeRe = new RegExp(`</${name}\\s*>`, 'i');
      closeRe.lastIndex = i;
      const cm = closeRe.exec(src);
      const end = cm ? cm.index : src.length;
      chunks.push({
        kind: 'raw',
        name,
        open: tagText,
        text: src.slice(i, end),
        close: cm ? cm[0] : '',
      });
      i = end + (cm ? cm[0].length : 0);
      continue;
    }

    chunks.push({ kind: 'tag', text: tagText, name, closing, selfClosing });
  }
  flushText();
  return chunks;
}

/** Collapse whitespace outside quoted attribute values; drop space before `>`. */
function normalizeTag(tag: string): string {
  let out = '';
  let quote = '';
  for (let i = 0; i < tag.length; i++) {
    const c = tag[i];
    if (quote) {
      out += c;
      if (c === quote) quote = '';
      continue;
    }
    if (c === '"' || c === "'") {
      quote = c;
      out += c;
      continue;
    }
    if (/\s/.test(c)) {
      if (!out.endsWith(' ')) out += ' ';
      continue;
    }
    out += c;
  }
  return out.replace(/ ?(\/?)>$/, '$1>');
}

function tagTypeAttr(openTag: string): string {
  const m = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>"']+))/i.exec(openTag);
  if (!m) return '';
  return (m[1] ?? m[2] ?? m[3] ?? '').toLowerCase();
}

function isJsScript(openTag: string): boolean {
  const type = tagTypeAttr(openTag);
  return !type || /javascript|ecmascript|^module$/.test(type);
}

function isCssStyle(openTag: string): boolean {
  const type = tagTypeAttr(openTag);
  return !type || type === 'text/css';
}

function chunkTagName(chunk: HtmlChunk | undefined): string {
  if (!chunk) return '';
  if (chunk.kind === 'tag') return chunk.name;
  if (chunk.kind === 'raw') return chunk.name;
  return '';
}

export function minifyHtml(src: string, keepComments = false): string {
  const chunks = scanHtml(src);
  let out = '';

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];

    if (chunk.kind === 'comment') {
      if (keepComments || chunk.text.startsWith('<!--[')) {
        out += chunk.text.replace(/\s+/g, ' ');
      }
      continue;
    }
    if (chunk.kind === 'doctype') {
      out += chunk.text.replace(/\s+/g, ' ');
      continue;
    }
    if (chunk.kind === 'tag') {
      out += normalizeTag(chunk.text);
      continue;
    }
    if (chunk.kind === 'raw') {
      let content = chunk.text;
      if (chunk.name === 'script' && isJsScript(chunk.open)) {
        content = content.trim() ? minifyJs(content.trim()) : '';
      } else if (chunk.name === 'style' && isCssStyle(chunk.open)) {
        content = content.trim() ? minifyCss(content.trim()) : '';
      }
      out += normalizeTag(chunk.open) + content + chunk.close;
      continue;
    }

    // Text node.
    const collapsed = chunk.text.replace(/\s+/g, ' ');
    const prev = chunks[ci - 1];
    const next = chunks[ci + 1];
    const prevInline = INLINE_TAGS.has(chunkTagName(prev));
    const nextInline = INLINE_TAGS.has(chunkTagName(next));

    if (chunk.text.trim() === '') {
      // Whitespace-only: keep a single space only between inline elements.
      if (prevInline && (nextInline || next?.kind === 'text')) out += ' ';
      continue;
    }
    let text = collapsed;
    if (!prevInline && prev) text = text.replace(/^ /, '');
    if (!nextInline && next) text = text.replace(/ $/, '');
    out += text;
  }
  return out.trim();
}

export function formatHtml(src: string, indentSize = 2): string {
  const chunks = scanHtml(src);
  let out = '';
  let line = '';
  let depth = 0;
  const pad = (d = depth) => ' '.repeat(Math.max(0, d) * indentSize);
  const flushLine = () => {
    const t = line.trim();
    if (t) out += `${pad()}${t}\n`;
    line = '';
  };
  const appendText = (t: string) => {
    if (!t) return;
    if (!line) line += t.replace(/^ /, '');
    else if (!line.endsWith(' ') || !t.startsWith(' ')) line += t;
  };

  // Index of the closing tag matching an open tag at index `open`, or -1.
  const matchingClose = (open: number): number => {
    const chunk = chunks[open];
    if (chunk.kind !== 'tag') return -1;
    let d = 0;
    for (let k = open + 1; k < chunks.length; k++) {
      const ch = chunks[k];
      if (ch.kind === 'tag' && ch.name === chunk.name) {
        if (ch.closing) {
          if (d === 0) return k;
          d--;
        } else if (!ch.selfClosing && !VOID_TAGS.has(ch.name)) {
          d++;
        }
      }
    }
    return -1;
  };

  // A block element whose content is only text and inline tags renders on one line.
  const inlineRender = (open: number, close: number): string | null => {
    const o = chunks[open];
    const c = chunks[close];
    if (o.kind !== 'tag' || c.kind !== 'tag') return null;
    let inner = '';
    for (let k = open + 1; k < close; k++) {
      const ch = chunks[k];
      if (ch.kind === 'text') {
        inner += ch.text.replace(/\s+/g, ' ');
        continue;
      }
      if (ch.kind === 'tag' && INLINE_TAGS.has(ch.name)) {
        inner += normalizeTag(ch.text);
        continue;
      }
      return null;
    }
    return `${normalizeTag(o.text)}${inner.trim()}${normalizeTag(c.text)}`;
  };

  for (let ci = 0; ci < chunks.length; ci++) {
    const chunk = chunks[ci];
    if (chunk.kind === 'comment' || chunk.kind === 'doctype') {
      flushLine();
      out += `${pad()}${chunk.text.replace(/\s+/g, ' ').trim()}\n`;
      continue;
    }
    if (chunk.kind === 'text') {
      const t = chunk.text.replace(/\s+/g, ' ');
      if (!t.trim()) {
        // Whitespace-only: keep a single space inside inline flow, drop at line start.
        if (line) appendText(' ');
        continue;
      }
      appendText(t);
      continue;
    }
    if (chunk.kind === 'raw') {
      flushLine();
      out += `${pad()}${normalizeTag(chunk.open)}\n`;
      const inner = chunk.text;
      if (inner.trim()) {
        if (chunk.name === 'script' && isJsScript(chunk.open)) {
          const formatted = formatJs(inner, indentSize);
          for (const l of formatted.split('\n')) {
            if (l.trim()) out += `${pad(depth + 1)}${l}\n`;
          }
        } else if (chunk.name === 'style' && isCssStyle(chunk.open)) {
          const formatted = formatCss(inner, indentSize);
          for (const l of formatted.split('\n')) {
            if (l.trim()) out += `${pad(depth + 1)}${l}\n`;
          }
        } else {
          // pre / textarea / unknown script type — preserve content verbatim.
          out += inner.replace(/^\n+/, '').replace(/\s+$/, '') + '\n';
        }
      }
      if (chunk.close) out += `${pad()}${chunk.close}\n`;
      continue;
    }

    // tag
    const tagText = normalizeTag(chunk.text);
    const isInline = INLINE_TAGS.has(chunk.name);
    if (chunk.closing || isInline || VOID_TAGS.has(chunk.name) || chunk.selfClosing) {
      if (chunk.closing && !isInline) {
        flushLine();
        depth = Math.max(0, depth - 1);
        out += `${pad()}${tagText}\n`;
        continue;
      }
      // inline or void — keep flowing on the current line
      appendText(tagText);
      continue;
    }

    // block opening tag
    const closeIdx = matchingClose(ci);
    if (closeIdx !== -1) {
      const oneLine = inlineRender(ci, closeIdx);
      if (oneLine !== null) {
        flushLine();
        out += `${pad()}${oneLine}\n`;
        ci = closeIdx;
        continue;
      }
    }
    flushLine();
    out += `${pad()}${tagText}\n`;
    depth++;
  }
  flushLine();
  return out.trimEnd();
}

/* ============================ Entry point ============================ */

export interface TransformOptions {
  indentSize?: number;
  keepComments?: boolean;
}

export function transformCode(
  src: string,
  lang: CodeLanguage,
  mode: CodeMode,
  opts: TransformOptions = {},
): string {
  const indent = opts.indentSize ?? 2;
  if (mode === 'minify') {
    if (lang === 'css') return minifyCss(src);
    if (lang === 'js') return minifyJs(src);
    return minifyHtml(src, opts.keepComments ?? false);
  }
  if (lang === 'css') return formatCss(src, indent);
  if (lang === 'js') return formatJs(src, indent);
  return formatHtml(src, indent);
}
