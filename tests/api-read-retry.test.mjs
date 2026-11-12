import assert from 'node:assert/strict'
import { test } from 'node:test'
import { AxiosError } from 'axios'
import { createServer } from 'vite'

test('transient read failures retry without resending mutations or forbidden reads', async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, ws: false, watch: null },
    appType: 'custom',
  })
  try {
    const { default: client } = await server.ssrLoadModule(
      '/src/shared/api/axiosClient.ts',
    )
    let attempts = 0
    const { data } = await client.get('/read', {
      adapter: async (config) => {
        if (++attempts === 1) {
          throw new AxiosError('Network error', 'ERR_NETWORK', config)
        }
        return {
          config,
          data: 'ok',
          headers: {},
          status: 200,
          statusText: 'OK',
        }
      },
    })
    assert.equal(data, 'ok')
    assert.equal(attempts, 2)

    for (const [method, status] of [
      ['post', 503],
      ['get', 403],
    ]) {
      attempts = 0
      await assert.rejects(
        client('/test', {
          method,
          adapter: async (config) => {
            attempts++
            throw new AxiosError(
              'Request failed',
              'ERR_BAD_RESPONSE',
              config,
              null,
              {
                config,
                data: null,
                headers: {},
                status,
                statusText: 'Error',
              },
            )
          },
        }),
      )
      assert.equal(attempts, 1)
    }
  } finally {
    await server.close()
  }
})
