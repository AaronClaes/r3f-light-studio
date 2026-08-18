import { defineConfig } from 'tsup'

/**
 * Two entries with one pass, so the `core/save.ts` constants they share are
 * emitted once. `platform: 'neutral'` because one entry is browser code and the
 * other is the Vite plugin: nothing here is bundled except our own files, so
 * neither platform's resolution rules are needed.
 *
 * Types come from `tsc` in the build script rather than from tsup, whose
 * bundled rollup-plugin-dts reads TypeScript 5 internals and this repo is on 7.
 */
export default defineConfig({
  entry: ['src/index.ts', 'src/vite/index.ts'],
  outDir: 'dist',
  format: ['esm'],
  platform: 'neutral',
  target: 'es2022',
  sourcemap: true,
  clean: true,

  // tsup rewrites `node:fs/promises` to bare `fs/promises` by default. Both
  // resolve, but the plugin is Node's to read and should say so as the source does.
  removeNodeProtocol: false,

  // Required, not an optimisation: it is what keeps the editor's dynamic import
  // a chunk of its own rather than inlining leva into the runtime entry.
  splitting: true,

  // A library minifies nothing. The consumer's bundler does it with better
  // information, and unminified output keeps their stack traces readable.
  minify: false,

  /**
   * Everything but our own source. Listing the subpaths as patterns matters:
   * `three/examples/jsm/...` is imported for the rect-area light tables and
   * would otherwise be pulled in whole.
   */
  external: [
    /^react($|\/)/,
    /^react-dom($|\/)/,
    /^three($|\/)/,
    /^@react-three\//,
    /^leva($|\/)/,
    /^zustand($|\/)/,
    /^vite($|\/)/,
    /^node:/,
  ],
})
