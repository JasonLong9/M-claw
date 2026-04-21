import { describe, expect, it } from 'vitest'

import modelConfigModalShellSource from '../FeishuModelConfigModalShell.tsx?raw'

describe('FeishuModelConfigModalShell', () => {
  it('keeps the shared model-config shell contract for title, body state, and save wiring', () => {
    expect(modelConfigModalShellSource).toContain("import type { ModelSelectOption } from '../pages/channels-page-model-options'")
    expect(modelConfigModalShellSource).toContain("import FeishuModelConfigModalBody from './FeishuModelConfigModalBody'")
    expect(modelConfigModalShellSource).toContain('opened: boolean')
    expect(modelConfigModalShellSource).toContain('onClose: () => void')
    expect(modelConfigModalShellSource).toContain('botName?: string | null')
    expect(modelConfigModalShellSource).toContain('agentId?: string')
    expect(modelConfigModalShellSource).toContain('currentRuntimeModel?: string | null')
    expect(modelConfigModalShellSource).toContain('errorMessage?: string')
    expect(modelConfigModalShellSource).toContain('loading?: boolean')
    expect(modelConfigModalShellSource).toContain('modelOptions: ModelSelectOption[]')
    expect(modelConfigModalShellSource).toContain('selectedModelValue: string | null')
    expect(modelConfigModalShellSource).toContain('saving?: boolean')
    expect(modelConfigModalShellSource).toContain('onChangeModel: (value: string | null) => void')
    expect(modelConfigModalShellSource).toContain('onSave: () => void')
  })

  it('renders one shared model-config shell that wraps the shared body in a modal with a derived title', () => {
    expect(modelConfigModalShellSource).toContain('title={botName ? `${botName} model configuration` : \'Feishu bot model configuration\'}')
    expect(modelConfigModalShellSource).toContain('size="lg"')
    expect(modelConfigModalShellSource).toContain('<FeishuModelConfigModalBody')
    expect(modelConfigModalShellSource).toContain('agentId={agentId}')
    expect(modelConfigModalShellSource).toContain('currentRuntimeModel={currentRuntimeModel}')
    expect(modelConfigModalShellSource).toContain('errorMessage={errorMessage}')
    expect(modelConfigModalShellSource).toContain('loading={loading}')
    expect(modelConfigModalShellSource).toContain('modelOptions={modelOptions}')
    expect(modelConfigModalShellSource).toContain('selectedModelValue={selectedModelValue}')
    expect(modelConfigModalShellSource).toContain('saving={saving}')
    expect(modelConfigModalShellSource).toContain('onChangeModel={onChangeModel}')
    expect(modelConfigModalShellSource).toContain('onClose={onClose}')
    expect(modelConfigModalShellSource).toContain('onSave={onSave}')
  })
})
