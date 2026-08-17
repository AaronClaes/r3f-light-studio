import { keyFor, readSession, writeSession } from './session'

export function readVisible(id: string): boolean {
  return readSession(keyFor('visible', id)) === 'true'
}

export function writeVisible(id: string, visible: boolean): void {
  writeSession(keyFor('visible', id), visible ? 'true' : null)
}
