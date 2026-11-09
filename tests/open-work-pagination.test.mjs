import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer } from 'vite'
import ts from 'typescript'

test('open work pagination excludes finished documents before slicing each merged page', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, hmr: false, watch: null },
    appType: 'custom',
    plugins: [
      {
        name: 'open-work-fixture',
        enforce: 'pre',
        resolveId(id) {
          if (id === 'test:work-runtime') return '\0' + id
        },
        load(id) {
          if (id !== '\0test:work-runtime') return
          return `
          let state, effect, requests = [];
          export function reset() { state = undefined; effect = undefined; requests = [] }
          export function useState() { return [state, value => { state = value }] }
          export function useEffect(fn) { effect = fn }
          export async function settle() {
            const cleanup = effect();
            const deadline = Date.now() + 5000;
            while (!state && Date.now() < deadline) await new Promise(r => setTimeout(r, 10));
            cleanup();
            if (!state) throw new Error('Hook did not settle');
          }
          export function calls() { return requests }
          export const client = { async get(path, { params }) {
            requests.push({ path, ...params });
            const group = ['DRAFT', 'COUNTING', 'AWAITING_APPROVAL', 'AWAITING_DISPATCH', 'IN_TRANSIT', 'RECONCILING'].indexOf(params.status);
            if (group < 0) throw new Error('Unfiltered request would contain completed work');
            const items = Array.from({ length: 25 }, (_, i) => ({
              id: group * 100 + i, status: params.status, createdAt: '2026-11-09T09:00:00'
            })).reverse().slice(params.page * params.size, (params.page + 1) * params.size);
            const page = { items, totalItems: 25, page: params.page, size: params.size };
            return { data: path === '/stock-counts' ? { counts: page, pendingRequests: [] } : page };
          }};
        `
        },
        transform(source, id) {
          if (
            !/\/(useCountList|useOpenTransfers)\.ts$/.test(
              id.replaceAll('\\', '/'),
            )
          )
            return
          const output = ts.transpileModule(source, {
            compilerOptions: {
              module: ts.ModuleKind.ESNext,
              target: ts.ScriptTarget.ES2022,
            },
          }).outputText
          return output
            .replace(
              /import .* from 'react';/,
              "import { useState, useEffect } from 'test:work-runtime';",
            )
            .replace(
              /import axiosClient from '[^']+';/,
              "import { client as axiosClient } from 'test:work-runtime';",
            )
            .replace(
              /import .* from '[^']*\/api';/,
              `
            const inventoryError = e => e.message;
            const useInventoryData = () => ({ loading: false });
          `,
            )
        },
      },
    ],
  })
  try {
    const runtime = await server.ssrLoadModule('test:work-runtime')
    const { useOpenTransfers } = await server.ssrLoadModule(
      '/src/modules/transfers/useOpenTransfers.ts',
    )
    const { useCountList } = await server.ssrLoadModule(
      '/src/modules/inventory/useCountList.ts',
    )
    for (const [hook, statuses, count] of [
      [
        (page) => useOpenTransfers({}, page, true),
        ['AWAITING_DISPATCH', 'IN_TRANSIT', 'RECONCILING'],
        false,
      ],
      [
        (page) =>
          useCountList({ status: 'OPEN', page }, 0, true, [
            'DRAFT',
            'COUNTING',
          ]),
        ['DRAFT', 'COUNTING'],
        true,
      ],
      [
        (page) => useCountList({ status: 'OPEN', page }, 0),
        ['DRAFT', 'COUNTING', 'AWAITING_APPROVAL'],
        true,
      ],
    ]) {
      const pages = []
      for (const page of [0, 1]) {
        runtime.reset()
        hook(page)
        await runtime.settle()
        const result = hook(page)
        assert.equal(result.error, undefined)
        assert.equal(result.loading, false)
        const data = count ? result.data.counts : result.data
        assert.equal(data.totalItems, statuses.length * 25)
        assert.equal(data.items.length, 20)
        assert.deepEqual(
          [...new Set(runtime.calls().map((r) => r.status))].sort(),
          [...statuses].sort(),
        )
        assert.ok(data.items.every((row) => statuses.includes(row.status)))
        pages.push(data.items.map((row) => row.id))
      }
      const all = statuses
        .flatMap((status) => {
          const group = [
            'DRAFT',
            'COUNTING',
            'AWAITING_APPROVAL',
            'AWAITING_DISPATCH',
            'IN_TRANSIT',
            'RECONCILING',
          ].indexOf(status)
          return Array.from({ length: 25 }, (_, i) => group * 100 + i)
        })
        .sort((a, b) => b - a)
      assert.deepEqual(pages.flat(), all.slice(0, 40))
    }
  } finally {
    await server.close()
  }
})
