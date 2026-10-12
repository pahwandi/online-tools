import { createMemo, createSignal, onSettled } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';

// ---------- YAML dump (JSON value -> YAML text) ----------

function yamlNeedsQuote(s: string): boolean {
  if (s === '') return true;
  const reserved = [
    'true', 'false', 'null', '~', 'yes', 'no', 'on', 'off',
    'True', 'False', 'Null', 'YES', 'NO', 'ON', 'OFF',
  ];
  if (reserved.includes(s)) return true;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(s)) return true;
  if (/^\s|\s$/.test(s)) return true;
  if (/[:#{}[\],&*!|>'"%@`]/.test(s)) return true;
  if (/^\s*(-\s|\?\s|:)/.test(s)) return true;
  if (s.includes('\n') || s.includes('\r')) return true;
  if (!/^[\x20-\x7E\u00A0-\uFFFF]*$/.test(s)) return true;
  return false;
}

function yamlScalar(value: unknown): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') {
    return Number.isFinite(value) ? String(value) : `'${String(value)}'`;
  }
  if (typeof value === 'string') {
    return yamlNeedsQuote(value) ? JSON.stringify(value) : value;
  }
  return JSON.stringify(String(value));
}

function dumpYaml(value: unknown, level: number): string {
  const pad = '  '.repeat(level);
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item) => {
        if (item !== null && typeof item === 'object') {
          const nested = dumpYaml(item, level + 1);
          const lines = nested.split('\n');
          if (Array.isArray(item)) {
            return `${pad}-\n${lines.join('\n')}`;
          }
          const [first, ...rest] = lines;
          const firstStripped = first.replace(/^  /, '');
          const head = `${pad}- ${firstStripped}`;
          return rest.length > 0 ? [head, ...rest].join('\n') : head;
        }
        return `${pad}- ${yamlScalar(item)}`;
      })
      .join('\n');
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value);
    if (entries.length === 0) return '{}';
    return entries
      .map(([key, val]) => {
        const k = yamlNeedsQuote(key) ? JSON.stringify(key) : key;
        if (val !== null && typeof val === 'object') {
          const nested = dumpYaml(val, level + 1);
          if (nested === '[]' || nested === '{}') return `${pad}${k}: ${nested}`;
          return `${pad}${k}:\n${nested}`;
        }
        return `${pad}${k}: ${yamlScalar(val)}`;
      })
      .join('\n');
  }
  return `${pad}${yamlScalar(value)}`;
}

export function jsonToYamlText(value: unknown): string {
  if (value !== null && typeof value === 'object') {
    const out = dumpYaml(value, 0);
    return out === '[]' || out === '{}' ? out + '\n' : out + '\n';
  }
  return yamlScalar(value) + '\n';
}

// ---------- YAML parse (YAML text -> JSON value) ----------

interface Line {
  indent: number;
  content: string;
}

function stripComment(line: string): string {
  let single = false;
  let double = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !double) {
      single = !single;
    } else if (ch === '"' && !single) {
      if (line[i - 1] !== '\\') double = !double;
    } else if (ch === '#' && !single && !double) {
      if (i === 0 || line[i - 1] === ' ' || line[i - 1] === '\t') {
        return line.slice(0, i).trimEnd();
      }
    }
  }
  return line;
}

function unquote(s: string): string {
  if (s.length >= 2 && s[0] === '"' && s[s.length - 1] === '"') {
    try {
      return JSON.parse(s);
    } catch {
      return s.slice(1, -1);
    }
  }
  if (s.length >= 2 && s[0] === "'" && s[s.length - 1] === "'") {
    return s.slice(1, -1).replace(/''/g, "'");
  }
  return s;
}

function parseScalar(s: string): unknown {
  const t = s.trim();
  if (t === '' || t === 'null' || t === 'Null' || t === 'NULL' || t === '~') return null;
  if (t === 'true' || t === 'True' || t === 'TRUE') return true;
  if (t === 'false' || t === 'False' || t === 'FALSE') return false;
  if (/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) {
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  if (
    (t[0] === '[' && t[t.length - 1] === ']') ||
    (t[0] === '{' && t[t.length - 1] === '}')
  ) {
    try {
      return JSON.parse(t);
    } catch {
      // fall through to plain string
    }
  }
  return unquote(t);
}

function splitMapping(content: string): [string, string] | null {
  let single = false;
  let double = false;
  let depth = 0;
  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    if (ch === "'" && !double) single = !single;
    else if (ch === '"' && !single) {
      if (content[i - 1] !== '\\') double = !double;
    } else if (!single && !double) {
      if (ch === '[' || ch === '{') depth++;
      else if (ch === ']' || ch === '}') depth--;
      else if (ch === ':' && depth === 0) {
        const after = content[i + 1];
        if (after === undefined || after === ' ' || after === '\t') {
          return [content.slice(0, i).trim(), content.slice(i + 1).trim()];
        }
      }
    }
  }
  return null;
}

class YamlParser {
  lines: Line[];
  pos = 0;

  constructor(src: string) {
    const raw = src.replace(/\t/g, '  ').split(/\r?\n/);
    this.lines = [];
    for (const r of raw) {
      if (r.trim() === '' || r.trimStart().startsWith('#')) continue;
      if (r.trim() === '---' || r.trim() === '...') continue;
      const indent = r.length - r.trimStart().length;
      const content = stripComment(r.trim());
      if (content === '') continue;
      this.lines.push({ indent, content });
    }
  }

  parse(): unknown {
    if (this.lines.length === 0) return null;
    // Document starting with "- " at top level is a sequence
    if (this.lines[0].content === '-' || this.lines[0].content.startsWith('- ')) {
      return this.parseSequence(this.lines[0].indent);
    }
    if (splitMapping(this.lines[0].content) !== null) {
      return this.parseMapping(this.lines[0].indent);
    }
    if (this.lines.length === 1) return parseScalar(this.lines[0].content);
    throw new Error('Could not parse YAML: mixed top-level content.');
  }

  parseSequence(indent: number): unknown[] {
    const out: unknown[] = [];
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      if (line.indent !== indent) break;
      if (line.content !== '-' && !line.content.startsWith('- ')) break;
      this.pos++;
      const rest = line.content === '-' ? '' : line.content.slice(2).trim();
      if (rest === '') {
        if (this.pos >= this.lines.length || this.lines[this.pos].indent <= indent) {
          out.push(null);
        } else {
          out.push(this.parseBlock(this.lines[this.pos].indent));
        }
      } else if (rest.startsWith('- ') || rest === '-') {
        throw new Error('Could not parse YAML: unexpected nested dash.');
      } else {
        const pair = splitMapping(rest);
        if (pair !== null) {
          // Inline map: "- key: value" plus continuation lines
          const obj: Record<string, unknown> = {};
          const [k, v] = pair;
          obj[unquote(k)] = v === ''
            ? this.nestedOrNull(indent + 2)
            : parseScalar(v);
          while (
            this.pos < this.lines.length &&
            this.lines[this.pos].indent > indent &&
            !this.lines[this.pos].content.startsWith('- ') &&
            this.lines[this.pos].content !== '-' &&
            splitMapping(this.lines[this.pos].content) !== null
          ) {
            const cont = splitMapping(this.lines[this.pos].content);
            if (!cont) break;
            this.pos++;
            const [ck, cv] = cont;
            obj[unquote(ck)] = cv === ''
              ? this.nestedOrNull(this.lines[this.pos - 1].indent + 2)
              : parseScalar(cv);
          }
          out.push(obj);
        } else {
          out.push(parseScalar(rest));
        }
      }
    }
    return out;
  }

  nestedOrNull(minIndent: number): unknown {
    if (this.pos < this.lines.length && this.lines[this.pos].indent >= minIndent) {
      return this.parseBlock(this.lines[this.pos].indent);
    }
    return null;
  }

  parseMapping(indent: number): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    while (this.pos < this.lines.length) {
      const line = this.lines[this.pos];
      if (line.indent !== indent) break;
      if (line.content === '-' || line.content.startsWith('- ')) break;
      const pair = splitMapping(line.content);
      if (!pair) break;
      this.pos++;
      const [k, v] = pair;
      const key = unquote(k);
      if (key === '') throw new Error('Could not parse YAML: empty mapping key.');
      if (Object.prototype.hasOwnProperty.call(out, key)) {
        throw new Error(`Duplicate mapping key "${key}".`);
      }
      out[key] = v === ''
        ? this.nestedOrNull(indent + 1)
        : parseScalar(v);
    }
    return out;
  }

  parseBlock(indent: number): unknown {
    const line = this.lines[this.pos];
    if (line.content === '-' || line.content.startsWith('- ')) {
      return this.parseSequence(indent);
    }
    if (splitMapping(line.content) !== null) {
      return this.parseMapping(indent);
    }
    this.pos++;
    return parseScalar(line.content);
  }
}

export function yamlToJsonValue(src: string): unknown {
  return new YamlParser(src).parse();
}

// ---------- Component ----------

const JSON_SAMPLE = `{
  "name": "Hari Pahwandi",
  "age": 30,
  "active": true,
  "roles": ["engineer", "writer"],
  "address": {
    "city": "Bandung",
    "zip": null
  }
}`;

const YAML_SAMPLE = `name: Hari Pahwandi
age: 30
active: true
roles:
  - engineer
  - writer
address:
  city: Bandung
  zip: null
`;

export default function JsonToYaml() {
  const [mode, setMode] = createSignal<'json2yaml' | 'yaml2json'>('json2yaml');
  const [jsonInput, setJsonInput] = createSignal(JSON_SAMPLE);
  const [yamlInput, setYamlInput] = createSignal(YAML_SAMPLE);
  const [indent, setIndent] = createSignal(2);
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | JSON to YAML';
  });

  const output = createMemo(() => {
    if (mode() === 'json2yaml') {
      const src = jsonInput();
      if (!src.trim()) return { text: '', error: '' };
      try {
        return { text: jsonToYamlText(JSON.parse(src)), error: '' };
      } catch (err) {
        return { text: '', error: err instanceof Error ? err.message : String(err) };
      }
    }
    const src = yamlInput();
    if (!src.trim()) return { text: '', error: '' };
    try {
      return {
        text: JSON.stringify(yamlToJsonValue(src), null, indent()),
        error: '',
      };
    } catch (err) {
      return { text: '', error: err instanceof Error ? err.message : String(err) };
    }
  });

  const download = () => {
    const text = output().text;
    if (!text) return;
    const isYaml = mode() === 'json2yaml';
    const blob = new Blob([text], {
      type: isYaml ? 'text/yaml;charset=utf-8;' : 'application/json;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isYaml ? 'data.yaml' : 'data.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const inputLabel = () =>
    mode() === 'json2yaml' ? 'Input (JSON)' : 'Input (YAML)';
  const outputLabel = () =>
    mode() === 'json2yaml' ? 'Output (YAML)' : 'Output (JSON)';

  return (
    <Section
      title="JSON to YAML"
      description="Convert JSON to YAML and back. Block mappings, sequences, quoted strings, inline flow collections, and comments are handled — all locally in your browser."
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <button
            type="button"
            class={btnClass(mode() === 'json2yaml')}
            onClick={() => setMode('json2yaml')}
          >
            JSON → YAML
          </button>
          <button
            type="button"
            class={btnClass(mode() === 'yaml2json')}
            onClick={() => setMode('yaml2json')}
          >
            YAML → JSON
          </button>
          {mode() === 'yaml2json' && (
            <>
              <span class="text-stone-500 dark:text-stone-400 ml-2">Indent</span>
              <button
                type="button"
                class={btnClass(indent() === 2)}
                onClick={() => setIndent(2)}
              >
                2
              </button>
              <button
                type="button"
                class={btnClass(indent() === 4)}
                onClick={() => setIndent(4)}
              >
                4
              </button>
            </>
          )}
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onClick={download} class={actionBtnClass()}>
            Download
          </button>
          <button
            type="button"
            onClick={() => copy('out', output().text)}
            class={actionBtnClass()}
          >
            {copiedKey() === 'out' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <label class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">{inputLabel()}</span>
          <textarea
            value={mode() === 'json2yaml' ? jsonInput() : yamlInput()}
            onInput={(e) =>
              mode() === 'json2yaml'
                ? setJsonInput(e.currentTarget.value)
                : setYamlInput(e.currentTarget.value)
            }
            spellcheck="false"
            class="w-full h-150 font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 resize-y"
          />
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">{outputLabel()}</span>
          <pre class="w-full h-150 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre">
            {output().text}
          </pre>
        </div>
      </div>

      {output().error && (
        <p class="text-sm text-red-600 dark:text-red-400">{output().error}</p>
      )}
    </Section>
  );
}
