import { describe, expect, it } from 'vitest'

import modelConfigModalBodySource from '../FeishuModelConfigModalBody.tsx?raw'

describe('FeishuModelConfigModalBody', () => {
  it('keeps the shared model-config contract for model options, loading state, and actions', () => {
    expect(modelConfigModalBodySource).toContain("import type { ModelSelectOption } from '../pages/channels-page-model-options'")
    expect(modelConfigModalBodySource).toContain('agentId?: string')
    expect(modelConfigModalBodySource).toContain('currentRuntimeModel?: string | null')
    expect(modelConfigModalBodySource).toContain('errorMessage?: string')
    expect(modelConfigModalBodySource).toContain('loading?: boolean')
    expect(modelConfigModalBodySource).toContain('modelOptions: ModelSelectOption[]')
    expect(modelConfigModalBodySource).toContain('selectedModelValue: string | null')
    expect(modelConfigModalBodySource).toContain('saving?: boolean')
    expect(modelConfigModalBodySource).toContain('onChangeModel: (value: string | null) => void')
    expect(modelConfigModalBodySource).toContain('onClose: () => void')
    expect(modelConfigModalBodySource).toContain('onSave: () => void')
  })

  it('renders one shared model-config body with runtime, error, select, and footer actions', () => {
    expect(modelConfigModalBodySource).toContain('Agent: {agentId}')
    expect(modelConfigModalBodySource).toContain('title="Current runtime model"')
    expect(modelConfigModalBodySource).toContain('title="Model configuration note"')
    expect(modelConfigModalBodySource).toContain('label="Primary model"')
    expect(modelConfigModalBodySource).toContain('placeholder="Select the model to bind to this Feishu bot"')
    expect(modelConfigModalBodySource).toContain('onChange={onChangeModel}')
    expect(modelConfigModalBodySource).toContain('nothingFoundMessage="No matching model"')
    expect(modelConfigModalBodySource).toContain('<Loader size="md" />')
    expect(modelConfigModalBodySource).toContain('<Button variant="default" onClick={onClose} disabled={saving}>')
    expect(modelConfigModalBodySource).toContain('<Button onClick={onSave} loading={saving} disabled={loading}>')
  })
})
