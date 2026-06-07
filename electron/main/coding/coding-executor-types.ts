export type CodingProgressEvent =
  | { type: 'text-delta'; delta: string; text: string; model?: string }
  | { type: 'complete'; result: string; model?: string }

export interface CodingExecutorParams {
  prompt: string
  systemPrompt?: string
  model?: string
  cwd: string
  maxTurns?: number
  signal?: AbortSignal
  onProgress?: (event: CodingProgressEvent) => void
}

export interface CodingExecutorResult {
  ok: boolean
  result: string
  model?: string
  stdout: string
  stderr: string
  code: number | null
  canceled?: boolean
  errorMessage?: string
}

export interface CodingExecutor {
  execute(params: CodingExecutorParams): Promise<CodingExecutorResult>
}
