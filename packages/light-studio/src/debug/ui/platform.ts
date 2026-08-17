/**
 * Only ever a label: the bindings accept either modifier everywhere, so the
 * worst this can be is the wrong word in a tooltip. `navigator.platform` is
 * deprecated and still the only thing every browser agrees on.
 */
export const MOD = /mac/i.test(navigator.platform) ? 'Cmd' : 'Ctrl'
