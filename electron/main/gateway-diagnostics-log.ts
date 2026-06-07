import type { DiagnosticsTrace, DiagnosticsTraceEntry } from '../../src/shared/gateway-diagnostics-trace'

const pathMod = process.getBuiltinModule('node:path') as typeof import('node:path')
const osMod = process.getBuiltinModule('node:os') as typeof import('node:os')
const fsMod = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const { join } = pathMod
const { tmpdir } = osMod
const { mkdirSync, statSync, appendFileSync, writeFileSync } = fsMod

const LOG_DIR = join(tmpdir(), 'mclaw', 'gateway-run')
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB

let logDirEnsured = false

function ensureLogDir(): void {
  if (logDirEnsured) return
  mkdirSync(LOG_DIR, { recursive: true })
  logDirEnsured = true
}

export function createDiagnosticsFileTrace(suffix?: string): DiagnosticsTrace {
  ensureLogDir()
  const id = suffix || `${Date.now()}-${process.pid}`
  const filePath = join(LOG_DIR, `diagnostics-${id}.log`)

  return {
    add(entry: DiagnosticsTraceEntry) {
      try {
        const line = JSON.stringify({ ts: new Date().toISOString(), ...entry }) + '\n'
        try {
          const stat = statSync(filePath)
          if (stat.size > MAX_FILE_SIZE) {
            writeFileSync(filePath, line, 'utf8')
            return
          }
        } catch {
          // file doesn't exist yet, first write
        }
        appendFileSync(filePath, line, 'utf8')
      } catch {
        // never let diagnostics logging break the main flow
      }
    },
  }
}
