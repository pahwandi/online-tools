import { createMemo, createSignal, onSettled } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';

// ---------- Type inference ----------

type Shape =
  | { kind: 'string' }
  | { kind: 'number' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'unknown' }
  | { kind: 'array'; items: Shape }
  | { kind: 'object'; fields: Map<string, { shape: Shape; optional: boolean }> };

function shapeOf(value: unknown): Shape {
  if (value === null) return { kind: 'null' };
  if (Array.isArray(value)) {
    if (value.length === 0) return { kind: 'array', items: { kind: 'unknown' } };
    return { kind: 'array', items: mergeShapes(value.map(shapeOf)) };
  }
  if (typeof value === 'object') {
    const fields = new Map<string, { shape: Shape; optional: boolean }>();
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      fields.set(k, { shape: shapeOf(v), optional: false });
    }
    return { kind: 'object', fields };
  }
  if (typeof value === 'string') return { kind: 'string' };
  if (typeof value === 'number') return { kind: 'number' };
  if (typeof value === 'boolean') return { kind: 'boolean' };
  return { kind: 'unknown' };
}

function shapeKey(s: Shape): string {
  if (s.kind === 'object') {
    return `obj:${[...s.fields.keys()].sort().join(',')}`;
  }
  if (s.kind === 'array') return `arr:${shapeKey(s.items)}`;
  return s.kind;
}

function mergeShapes(shapes: Shape[]): Shape {
  const kinds = new Set(shapes.map((s) => s.kind));
  if (kinds.size === 1) {
    const kind = shapes[0].kind;
    if (kind === 'object') {
      const allKeys = new Set<string>();
      for (const s of shapes) {
        if (s.kind === 'object') {
          for (const k of s.fields.keys()) allKeys.add(k);
        }
      }
      const fields = new Map<string, { shape: Shape; optional: boolean }>();
      for (const key of allKeys) {
        const present: Shape[] = [];
        let missing = false;
        for (const s of shapes) {
          if (s.kind === 'object' && s.fields.has(key)) {
            present.push(s.fields.get(key)!.shape);
          } else {
            missing = true;
          }
        }
        fields.set(key, {
          shape: mergeShapes(present),
          optional: missing,
        });
      }
      return { kind: 'object', fields };
    }
    if (kind === 'array') {
      const items = shapes.map((s) => (s.kind === 'array' ? s.items : { kind: 'unknown' } as Shape));
      return { kind: 'array', items: mergeShapes(items) };
    }
    return shapes[0];
  }
  // Mixed kinds -> drop null into optional marker handled by caller; keep union of rest
  const dedup = new Map<string, Shape>();
  for (const s of shapes) dedup.set(shapeKey(s), s);
  const list = [...dedup.values()];
  if (list.length === 1) return list[0];
  // Encode union via nested "unknown"? Represent as union pseudo-shape using array hack:
  return { kind: 'array', items: { kind: 'unknown' }, __union: list } as UnionShape;
}

interface UnionShape {
  kind: 'array';
  items: Shape;
  __union: Shape[];
}

function isUnion(s: Shape): s is UnionShape {
  return s.kind === 'array' && '__union' in s;
}

// ---------- Naming ----------

function pascalCase(raw: string): string {
  const parts = raw.split(/[^A-Za-z0-9]+/).filter(Boolean);
  const name = parts.map((p) => p[0].toUpperCase() + p.slice(1)).join('');
  const clean = (name || 'Root').replace(/^(\d)/, 'N$1');
  return clean;
}

function sanitizeProp(key: string): string {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function childName(parent: string, key: string): string {
  return pascalCase(`${parent} ${key}`);
}

// ---------- TypeScript emit ----------

function tsType(s: Shape, hint: string): { type: string; defs: string[] } {
  if (isUnion(s)) {
    const parts = s.__union
      .filter((u) => u.kind !== 'null')
      .map((u) => tsType(u, hint).type);
    const uniq = [...new Set(parts.length > 0 ? parts : ['unknown'])];
    const hasNull = s.__union.some((u) => u.kind === 'null');
    const defs = s.__union.flatMap((u) => tsType(u, hint).defs);
    return { type: uniq.join(' | ') + (hasNull ? ' | null' : ''), defs };
  }
  switch (s.kind) {
    case 'string': return { type: 'string', defs: [] };
    case 'number': return { type: 'number', defs: [] };
    case 'boolean': return { type: 'boolean', defs: [] };
    case 'null': return { type: 'null', defs: [] };
    case 'unknown': return { type: 'unknown', defs: [] };
    case 'array': {
      if (s.items.kind === 'object' || isUnion(s.items)) {
        const name = `${hint}Item`;
        const built = buildInterface(name, s.items);
        return { type: `${name}[]`, defs: [...built.defs, built.decl] };
      }
      const inner = tsType(s.items, hint);
      return { type: `${inner.type}[]`, defs: inner.defs };
    }
    case 'object':
      return { type: hint, defs: [buildInterface(hint, s).decl, ...buildInterface(hint, s).defs].reverse() };
  }
}

function buildInterface(name: string, s: Shape): { decl: string; defs: string[] } {
  if (isUnion(s)) {
    const inner = tsType(s, name);
    return { decl: `export type ${name} = ${inner.type};`, defs: inner.defs };
  }
  if (s.kind !== 'object') {
    const inner = tsType(s, name);
    return { decl: `export type ${name} = ${inner.type};`, defs: inner.defs };
  }
  const defs: string[] = [];
  const lines: string[] = [];
  for (const [key, field] of s.fields) {
    const prop = sanitizeProp(key);
    const opt = field.optional ? '?' : '';
    if (field.shape.kind === 'object' || (field.shape.kind === 'array' && (field.shape.items.kind === 'object' || isUnion(field.shape.items)))) {
      const nested = childName(name, key);
      const t = tsType(field.shape, nested);
      defs.push(...t.defs);
      lines.push(`  ${prop}${opt}: ${t.type};`);
    } else if (isUnion(field.shape)) {
      const t = tsType(field.shape, childName(name, key));
      defs.push(...t.defs);
      lines.push(`  ${prop}${opt}: ${t.type};`);
    } else {
      const t = tsType(field.shape, childName(name, key));
      defs.push(...t.defs);
      lines.push(`  ${prop}${opt}: ${t.type};`);
    }
  }
  return { decl: `export interface ${name} {\n${lines.join('\n')}\n}`, defs };
}

export function jsonToTypeScript(value: unknown, rootRaw: string): string {
  const root = pascalCase(rootRaw || 'Root');
  const shape = shapeOf(value);
  if (shape.kind !== 'object' && !isUnion(shape) && shape.kind !== 'array') {
    const t = tsType(shape, root);
    return `export type ${root} = ${t.type};\n`;
  }
  if (shape.kind === 'array') {
    const items = isUnion(shape) ? shape : shape.items;
    const t = tsType(items, `${root}Item`);
    return [...t.defs, `export type ${root} = ${t.type}[];`].join('\n\n') + '\n';
  }
  const built = buildInterface(root, shape);
  return [...built.defs, built.decl].join('\n\n') + '\n';
}

// ---------- Zod emit ----------

function zodExpr(s: Shape, hint: string): { expr: string; defs: string[] } {
  if (isUnion(s)) {
    const nonNull = s.__union.filter((u) => u.kind !== 'null');
    const hasNull = s.__union.some((u) => u.kind === 'null');
    const parts = nonNull.map((u) => zodExpr(u, hint));
    const defs = parts.flatMap((p) => p.defs);
    let expr: string;
    if (parts.length === 0) expr = 'z.unknown()';
    else if (parts.length === 1) expr = parts[0].expr;
    else expr = `z.union([${parts.map((p) => p.expr).join(', ')}])`;
    if (hasNull) expr = parts.length === 1 ? `${expr}.nullable()` : `z.union([${expr}, z.null()])`;
    return { expr, defs };
  }
  switch (s.kind) {
    case 'string': return { expr: 'z.string()', defs: [] };
    case 'number': return { expr: 'z.number()', defs: [] };
    case 'boolean': return { expr: 'z.boolean()', defs: [] };
    case 'null': return { expr: 'z.null()', defs: [] };
    case 'unknown': return { expr: 'z.unknown()', defs: [] };
    case 'array': {
      const inner = zodExpr(s.items, hint);
      return { expr: `z.array(${inner.expr})`, defs: inner.defs };
    }
    case 'object': {
      const name = hint;
      const built = buildZod(name, s);
      return { expr: `${name}Schema`, defs: [...built.defs, built.decl] };
    }
  }
}

function buildZod(name: string, s: Shape): { decl: string; defs: string[] } {
  if (s.kind !== 'object') {
    const inner = zodExpr(s, name);
    return { decl: `const ${name}Schema = ${inner.expr};`, defs: inner.defs };
  }
  const defs: string[] = [];
  const lines: string[] = [];
  for (const [key, field] of s.fields) {
    const prop = sanitizeProp(key);
    const hint = childName(name, key);
    const z = zodExpr(field.shape, hint);
    defs.push(...z.defs);
    lines.push(`  ${prop}: ${z.expr}${field.optional ? '.optional()' : ''},`);
  }
  return { decl: `const ${name}Schema = z.object({\n${lines.join('\n')}\n});`, defs };
}

export function jsonToZod(value: unknown, rootRaw: string): string {
  const root = pascalCase(rootRaw || 'Root');
  const shape = shapeOf(value);
  const header = 'import { z } from "zod";\n';
  if (shape.kind === 'array') {
    const z = zodExpr(shape.items, `${root}Item`);
    return (
      header + '\n' +
      [...z.defs, `export const ${root}Schema = z.array(${z.expr});`, `export type ${root} = z.infer<typeof ${root}Schema>;`].join('\n\n') + '\n'
    );
  }
  const z = zodExpr(shape, root);
  if (shape.kind !== 'object' && !isUnion(shape)) {
    return header + `\nexport const ${root}Schema = ${z.expr};\nexport type ${root} = z.infer<typeof ${root}Schema>;\n`;
  }
  return (
    header + '\n' +
    [...z.defs, `export type ${root} = z.infer<typeof ${root}Schema>;`].join('\n\n') + '\n'
  );
}

// ---------- Component ----------

const SAMPLE = `{
  "id": 1,
  "name": "Hari Pahwandi",
  "active": true,
  "deletedAt": null,
  "tags": ["js", "vue"],
  "address": { "city": "Bandung", "zip": "40111" },
  "orders": [
    { "id": "a1", "total": 99.5 },
    { "id": "a2", "total": 12, "note": "gift" }
  ]
}`;

export default function JsonToTypescript() {
  const [input, setInput] = createSignal(SAMPLE);
  const [rootName, setRootName] = createSignal('Root');
  const [tab, setTab] = createSignal<'ts' | 'zod'>('ts');
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | JSON to TypeScript';
  });

  const result = createMemo(() => {
    const src = input();
    if (!src.trim()) return { ts: '', zod: '', error: '' };
    try {
      const value = JSON.parse(src);
      return {
        ts: jsonToTypeScript(value, rootName()),
        zod: jsonToZod(value, rootName()),
        error: '',
      };
    } catch (err) {
      return { ts: '', zod: '', error: err instanceof Error ? err.message : String(err) };
    }
  });

  const active = () => (tab() === 'ts' ? result().ts : result().zod);

  const download = () => {
    const text = active();
    if (!text) return;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = tab() === 'ts' ? 'types.ts' : 'schema.ts';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Section
      title="JSON to TypeScript"
      description="Paste JSON and get TypeScript interfaces plus a Zod schema. Array shapes are merged — keys missing in some items become optional."
    >
      <div class="flex items-center justify-between flex-wrap gap-3">
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <label class="flex items-center gap-2 text-stone-500 dark:text-stone-400">
            Root
            <input
              value={rootName()}
              onInput={(e) => setRootName(e.currentTarget.value)}
              spellcheck="false"
              class="w-32 px-2 py-1 font-mono text-sm rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
            />
          </label>
          <button
            type="button"
            class={btnClass(tab() === 'ts')}
            onClick={() => setTab('ts')}
          >
            TypeScript
          </button>
          <button
            type="button"
            class={btnClass(tab() === 'zod')}
            onClick={() => setTab('zod')}
          >
            Zod
          </button>
        </div>
        <div class="flex items-center gap-2">
          <button type="button" onClick={download} class={actionBtnClass()}>
            Download
          </button>
          <button
            type="button"
            onClick={() => copy('out', active())}
            class={actionBtnClass()}
          >
            {copiedKey() === 'out' ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
        <label class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Input (JSON)</span>
          <textarea
            value={input()}
            onInput={(e) => setInput(e.currentTarget.value)}
            spellcheck="false"
            class="w-full h-150 font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 resize-y"
          />
        </label>

        <div class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">
            Output ({tab() === 'ts' ? 'TypeScript' : 'Zod'})
          </span>
          <pre class="w-full h-150 overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre">
            {active()}
          </pre>
        </div>
      </div>

      {result().error && (
        <p class="text-sm text-red-600 dark:text-red-400">{result().error}</p>
      )}
    </Section>
  );
}
