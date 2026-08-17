/**
 * What to call the command modifier on screen: `Cmd+D`, or `Ctrl+D`.
 *
 * Only ever a label. The bindings themselves accept either modifier on every
 * platform, so the worst this can be is the wrong word in a tooltip.
 *
 * `navigator.platform` is deprecated and still the only thing every browser
 * agrees on. Read once, in the debug chunk, which never reaches production.
 */
export const MOD = /mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'
