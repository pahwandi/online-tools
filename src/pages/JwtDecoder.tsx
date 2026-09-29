import { createMemo, createSignal, For, onSettled, Show } from 'solid-js';
import Section from '../components/Section';
import { actionBtnClass, btnClass } from '../lib/ui';
import { createCopier } from '../lib/clipboard';
import {
  claimRows,
  decodeJwt,
  tokenTimeStatus,
  verifyHmac,
  type VerifyResult,
} from '../lib/jwt';

const SAMPLE =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJodHRwczovL2V4YW1wbGUuY29tIiwic3ViIjoiMTIzNDU2Nzg5MCIsImF1ZCI6ImFwaS5leGFtcGxlLmNvbSIsImV4cCI6NDEwMjQ0NDgwMCwibmJmIjoxNzY3MjI1NjAwLCJpYXQiOjE3NjcyMjU2MDAsImp0aSI6ImRlbW8tMjAyNi0wMDEiLCJuYW1lIjoiSGFyaSBQYWh3YW5kaSIsInJvbGUiOiJhZG1pbiJ9.KxrlAhFtwQztGhPYcdUepPcMKlbkFFKlq597zqUefIQ';

const SAMPLE_SECRET = 'demo-secret-256';

const preClass =
  'w-full overflow-auto font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 text-stone-900 dark:text-stone-100 whitespace-pre-wrap break-all';

function JsonBox(props: { label: string; part: { text: string; error: string } }) {
  return (
    <div class="flex flex-col gap-2">
      <span class="text-sm text-stone-500 dark:text-stone-400">{props.label}</span>
      <Show
        when={!props.part.error}
        fallback={
          <p class="text-sm text-red-600 dark:text-red-400">{props.part.error}</p>
        }
      >
        <pre class={preClass}>{props.part.text}</pre>
      </Show>
    </div>
  );
}

export default function JwtDecoder() {
  const [token, setToken] = createSignal(SAMPLE);
  const [secret, setSecret] = createSignal('');
  const [verify, setVerify] = createSignal<VerifyResult | null>(null);
  const [verifying, setVerifying] = createSignal(false);
  const { copiedKey, copy } = createCopier();

  onSettled(() => {
    document.title = 'Hari Pahwandi | JWT Decoder';
  });

  const info = createMemo(() => decodeJwt(token()));
  const claims = createMemo(() => claimRows(info().payload.data));
  const status = createMemo(() => tokenTimeStatus(info().payload.data));

  const isHmac = createMemo(() => /^HS(256|384|512)$/.test(info().alg));

  async function runVerify() {
    if (verifying()) return;
    setVerifying(true);
    try {
      setVerify(await verifyHmac(token(), secret()));
    } finally {
      setVerifying(false);
    }
  }

  return (
    <Section
      title="JWT Decoder"
      description="Inspect a JSON Web Token — decode the header and payload, read registered claims, check expiry, and verify HMAC signatures. The token never leaves your browser."
    >
      <div class="flex flex-col gap-2">
        <label class="flex flex-col gap-2">
          <span class="text-sm text-stone-500 dark:text-stone-400">Token</span>
          <textarea
            value={token()}
            onInput={(e) => {
              setToken(e.currentTarget.value);
              setVerify(null);
            }}
            spellcheck="false"
            aria-label="JWT token"
            class="w-full h-30 font-mono text-sm leading-relaxed p-4 rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100 resize-y break-all"
          />
        </label>
        <div class="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            class={actionBtnClass()}
            onClick={() => copy('token', token().trim())}
          >
            {copiedKey() === 'token' ? 'Copied!' : 'Copy token'}
          </button>
          <button
            type="button"
            class={btnClass(token() === SAMPLE)}
            onClick={() => {
              setToken(SAMPLE);
              setSecret('');
              setVerify(null);
            }}
          >
            Load sample
          </button>
          <button
            type="button"
            class={btnClass(false)}
            onClick={() => {
              setToken('');
              setSecret('');
              setVerify(null);
            }}
          >
            Clear
          </button>
        </div>
      </div>

      <Show when={info().error}>
        <p class="text-sm text-red-600 dark:text-red-400">{info().error}</p>
      </Show>

      <Show when={!info().empty && !info().error}>
        <div class="flex items-center gap-2 text-sm flex-wrap">
          <Show when={status().expired}>
            <span class="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-medium">
              Expired
            </span>
          </Show>
          <Show when={status().notYet}>
            <span class="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 text-xs font-medium">
              Not valid yet
            </span>
          </Show>
          <Show when={!status().expired && !status().notYet && status().expDate}>
            <span class="px-2 py-0.5 rounded-md bg-lime-100 dark:bg-lime-950 text-lime-800 dark:text-lime-300 text-xs font-medium">
              Time-valid
            </span>
          </Show>
          <Show when={info().alg}>
            <span class="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-900 border border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 text-xs font-mono">
              {info().alg}
            </span>
          </Show>
          <Show when={info().typ}>
            <span class="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-900 border border-stone-950/20 dark:border-stone-50/16 text-stone-600 dark:text-stone-400 text-xs font-mono">
              typ: {info().typ}
            </span>
          </Show>
          <Show when={!info().hasSignature}>
            <span class="px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300 text-xs font-medium">
              Unsecured — no signature
            </span>
          </Show>
        </div>

        <div class="grid grid-cols-2 max-[60rem]:grid-cols-1 gap-8">
          <JsonBox label="Header" part={info().header} />
          <JsonBox label="Payload" part={info().payload} />
        </div>

        <Show when={claims().length > 0}>
          <div class="overflow-x-auto rounded-lg border border-stone-950/20 dark:border-stone-50/16">
            <table class="w-full text-sm border-collapse">
              <thead>
                <tr class="bg-stone-100 dark:bg-stone-900 text-left">
                  <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Claim</th>
                  <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Meaning</th>
                  <th class="p-3 font-medium text-stone-500 dark:text-stone-400">Value</th>
                </tr>
              </thead>
              <tbody>
                <For each={claims()}>
                  {(row) => (
                    <tr class="border-t border-stone-950/10 dark:border-stone-50/10">
                      <td class="p-3 font-mono text-stone-900 dark:text-stone-100">{row.claim}</td>
                      <td class="p-3 text-stone-600 dark:text-stone-400">{row.human}</td>
                      <td class="p-3 font-mono text-stone-900 dark:text-stone-100 break-all">{row.value}</td>
                    </tr>
                  )}
                </For>
              </tbody>
            </table>
          </div>
        </Show>

        <div class="rounded-lg border border-stone-950/20 dark:border-stone-50/16 bg-stone-100 dark:bg-stone-900 p-4 flex flex-col gap-3">
          <div class="flex items-center justify-between gap-3 flex-wrap">
            <span class="text-xs text-stone-500 dark:text-stone-400">Signature</span>
            <Show when={info().algName}>
              <span class="text-xs text-stone-500 dark:text-stone-400">{info().algName}</span>
            </Show>
          </div>
          <p class="font-mono text-xs text-stone-900 dark:text-stone-100 break-all m-0 leading-relaxed">
            {info().hasSignature ? info().signature : '(none — unsecured JWS)'}
          </p>
          <Show when={info().kid}>
            <p class="text-xs text-stone-500 dark:text-stone-400 m-0">
              Key ID: <span class="font-mono">{info().kid}</span>
            </p>
          </Show>

          <Show when={isHmac()}>
            <div class="flex items-center gap-2 flex-wrap pt-1 border-t border-stone-950/10 dark:border-stone-50/10">
              <input
                type="password"
                value={secret()}
                onInput={(e) => {
                  setSecret(e.currentTarget.value);
                  setVerify(null);
                }}
                placeholder="Shared secret (stays local)"
                aria-label="Shared secret"
                class="flex-1 min-w-50 font-mono text-sm p-2 rounded-md border border-stone-950/20 dark:border-stone-50/16 bg-stone-50 dark:bg-stone-950 text-stone-900 dark:text-stone-100 focus:outline-none focus:ring-2 focus:ring-stone-900 dark:focus:ring-stone-100"
              />
              <button type="button" class={actionBtnClass()} onClick={runVerify}>
                {verifying() ? 'Verifying…' : 'Verify'}
              </button>
              <button
                type="button"
                class={btnClass(false)}
                title="Fill the sample secret for the sample token"
                onClick={() => {
                  setSecret(SAMPLE_SECRET);
                  setVerify(null);
                }}
              >
                Sample secret
              </button>
            </div>
            <Show when={verify()}>
              <Show
                when={!verify()!.error}
                fallback={
                  <p class="text-sm text-amber-600 dark:text-amber-400 m-0">{verify()!.error}</p>
                }
              >
                <p
                  class={[
                    'text-sm font-medium m-0',
                    verify()!.ok
                      ? 'text-lime-700 dark:text-lime-400'
                      : 'text-red-600 dark:text-red-400',
                  ]}
                >
                  {verify()!.ok
                    ? '✓ Signature valid for this secret'
                    : '✗ Signature does not match this secret'}
                </p>
              </Show>
            </Show>
          </Show>
          <Show when={!isHmac() && info().alg !== 'none'}>
            <p class="text-xs text-stone-500 dark:text-stone-400 m-0">
              This token uses {info().alg || 'an unknown algorithm'}. Verifying it requires the
              issuer's public key — this tool can only verify HMAC (HS*) tokens locally.
            </p>
          </Show>
        </div>

        <p class="text-xs text-stone-500 dark:text-stone-400">
          Decoding is not verification: anyone can base64-decode a JWT. Only trust claims after
          the signature is verified against a key you control. Everything here runs locally —
          nothing is sent anywhere.
        </p>
      </Show>
    </Section>
  );
}
