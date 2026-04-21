import { describe, expect, it } from 'vitest'

import modelModalPropsSource from '../channels-page-model-modal-props.ts?raw'

describe('channels-page-model-modal-props hook', () => {
  it('keeps the shared model-config modal surface contract in one hook', () => {
    expect(modelModalPropsSource).toContain("import type { ComponentProps } from 'react'")
    expect(modelModalPropsSource).toContain("import ChannelsPageModelConfigModal from '../components/ChannelsPageModelConfigModal'")
    expect(modelModalPropsSource).toContain('ChannelsPageModelModalPropsOptions,')
    expect(modelModalPropsSource).toContain('ChannelsPageModelModalPropsResult,')
    expect(modelModalPropsSource).toContain("} from './channels-page-model-modal-props-contract'")
    expect(modelModalPropsSource).toContain('export function useChannelsPageModelModalProps({')
    expect(modelModalPropsSource).toContain('}: ChannelsPageModelModalPropsOptions): ChannelsPageModelModalPropsResult {')
    expect(modelModalPropsSource).toContain('const modelConfigModalProps: ComponentProps<typeof ChannelsPageModelConfigModal> = {')
    expect(modelModalPropsSource).toContain('modelConfigModalProps,')
    expect(modelModalPropsSource).not.toContain('interface UseChannelsPageModelModalPropsOptions {')
  })

  it('keeps model-modal open, selection, and save wiring inside the shared hook', () => {
    expect(modelModalPropsSource).toContain('opened: showModelModal,')
    expect(modelModalPropsSource).toContain('channel: selectedModelChannel,')
    expect(modelModalPropsSource).toContain('onClose: closeModelModal,')
    expect(modelModalPropsSource).toContain('currentRuntimeModel,')
    expect(modelModalPropsSource).toContain('errorMessage: modelModalError,')
    expect(modelModalPropsSource).toContain('loading: loadingModelContext,')
    expect(modelModalPropsSource).toContain('modelOptions,')
    expect(modelModalPropsSource).toContain('selectedModelValue,')
    expect(modelModalPropsSource).toContain('saving: savingModel,')
    expect(modelModalPropsSource).toContain('onChangeSelectedModel: setSelectedModelValue,')
    expect(modelModalPropsSource).toContain('onSave: () => void handleSaveBotModel(),')
  })
})
