import { writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'

import type { Plugin } from 'vite'

// The one import in the package that names its extension. Every other file
// here is resolved by Vite; this one is loaded by Node, while it reads
// vite.config, and Node will not guess at a missing `.ts`. Worth the oddity to
// keep one definition of the route and the default id — the alternative is two
// copies that drift and take the Save button down with them.
import { DEFAULT_SAVE_ID, SAVE_ROUTE } from '../core/save.ts'

/**
 * Lets the editor write the rig back to the file it came from.
 *
 * ```ts
 * // vite.config.ts
 * plugins: [react(), lightStudio('src/lights.json')]
 * ```
 *
 * Pass an object to keep several rigs, and name one from the component:
 *
 * ```ts
 * plugins: [lightStudio({ hero: 'src/hero.json', product: 'src/product.json' })]
 * // <LightStudio id="hero" setup={hero} debug />
 * ```
 *
 * **The browser never sends a path.** It sends one of the ids declared here
 * and the server looks the path up, so there is nothing a page can say to this
 * that makes it write somewhere it was not told about. That matters more than
 * it looks: a dev server is often listening on the network, not just on
 * localhost.
 *
 * Dev only — `apply: 'serve'` keeps the whole thing out of a build.
 */
export function lightStudio(targets: string | Record<string, string>): Plugin {
  // A bare path is one target under the id a component gets when it names
  // none, so the common case needs nothing on the component at all.
  const files: Record<string, string> =
    typeof targets === 'string' ? { [DEFAULT_SAVE_ID]: targets } : { ...targets }

  let root = process.cwd()

  return {
    name: 'r3f-light-studio',
    apply: 'serve',

    configResolved(config) {
      root = config.root
    },

    configureServer(server) {
      server.middlewares.use(`${SAVE_ROUTE}/targets`, (_request, response) => {
        // Relative, because this is only ever shown to the person who wrote
        // the config and an absolute path tells them nothing they don't know.
        const paths = Object.fromEntries(
          Object.entries(files).map(([id, file]) => [
            id,
            path.relative(root, targetPath(root, file)),
          ]),
        )
        send(response, 200, { lightStudio: true, targets: paths })
      })

      server.middlewares.use(`${SAVE_ROUTE}/save`, async (request, response) => {
        if (request.method !== 'POST') return send(response, 405, { error: 'Use POST.' })

        let body: unknown
        try {
          body = JSON.parse(await read(request))
        } catch {
          return send(response, 400, { error: 'Body was not JSON.' })
        }

        if (!isSaveRequest(body)) {
          return send(response, 400, { error: 'Expected { id, json }.' })
        }

        const file = files[body.id]
        if (!file) {
          return send(response, 404, {
            error: `No target named "${body.id}". vite.config declares: ${Object.keys(files).join(', ') || 'nothing'}.`,
          })
        }

        const target = targetPath(root, file)
        try {
          await writeFile(target, body.json, 'utf8')
        } catch (error) {
          const reason = error instanceof Error ? error.message : String(error)
          return send(response, 500, { error: reason })
        }

        // The write is what tells the browser too: Vite notices the JSON
        // change and pushes it back through the import, so the page and the
        // file agree without a reload.
        server.config.logger.info(`[light-studio] wrote ${path.relative(root, target)}`)
        send(response, 200, { path: path.relative(root, target) })
      })
    },
  }
}

/**
 * Resolved against the Vite root, and deliberately not confined to it — in a
 * monorepo the rig can legitimately live in a sibling package. The path comes
 * from the developer's own config rather than from the page, so there is
 * nothing here for a browser to abuse.
 */
function targetPath(root: string, file: string): string {
  return path.resolve(root, file)
}

interface SaveRequest {
  id: string
  json: string
}

function isSaveRequest(body: unknown): body is SaveRequest {
  if (typeof body !== 'object' || body === null) return false
  const candidate = body as Record<string, unknown>
  return typeof candidate.id === 'string' && typeof candidate.json === 'string'
}

function read(request: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = ''
    request.setEncoding('utf8')
    request.on('data', (chunk: string) => {
      body += chunk
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })
}

function send(response: ServerResponse, status: number, payload: unknown): void {
  response.statusCode = status
  response.setHeader('Content-Type', 'application/json')
  response.end(JSON.stringify(payload))
}
