import { describe, expect, it } from 'vitest'

import modelConfigModalSource from '../ChannelsPageModelConfigModal.tsx?raw'

describe('ChannelsPageModelConfigModal', () => {
  it('keeps the shared model-config wrapper contract for selected channel state, modal state, and model selection wiring', () => {
    expect(modelConfigModalSource).toContain("import type { ModelSelectOption } from '../pages/channels-page-model-options'")
    expect(modelConfigModalSource).toContain("import FeishuModelConfigModalShell from './FeishuModelConfigModalShell'")
    expect(modelConfigModalSource).toContain('channel: ChannelsPageModelConfigModalChannel | null')
    expect(modelConfigModalSource).toContain('currentRuntimeModel?: string | null')
    expect(modelConfigModalSource).toContain('errorMessage?: string')
    expect(modelConfigModalSource).toContain('loading?: boolean')
    expect(modelConfigModalSource).toContain('modelOptions: ModelSelectOption[]')
    expect(modelConfigModalSource).toContain('selectedModelValue: string | null')
    expect(modelConfigModalSource).toContain('saving?: boolean')
    expect(modelConfigModalSource).toContain('onChangeSelectedModel: (value: string | null) => void')
    expect(modelConfigModalSource).toContain('onSave: () => void')
  })

  it('renders one shared model-config wrapper that derives shell identity from the selected channel object', () => {
    expect(modelConfigModalSource).toContain('<FeishuModelConfigModalShell')
    expect(modelConfigModalSource).toContain('botName={channel?.name}')
    expect(modelConfigModalSource).toContain('agentId={channel?.agentId}')
    expect(modelConfigModalSource).toContain('currentRuntimeModel={currentRuntimeModel}')
    expect(modelConfigModalSource).toContain('errorMessage={errorMessage}')
    expect(modelConfigModalSource).toContain('loading={loading}')
    expect(modelConfigModalSource).toContain('modelOptions={modelOptions}')
    expect(modelConfigModalSource).toContain('selectedModelValue={selectedModelValue}')
    expect(modelConfigModalSource).toContain('saving={saving}')
    expect(modelConfigModalSource).toContain('onChangeModel={onChangeSelectedModel}')
    expect(modelConfigModalSource).toContain('onSave={onSave}')
  })
})
