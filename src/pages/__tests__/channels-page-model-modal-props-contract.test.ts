import { describe, expect, it } from 'vitest'

import modelModalPropsContractSource from '../channels-page-model-modal-props-contract.ts?raw'

describe('channels-page-model-modal-props-contract module', () => {
  it('keeps the model modal input and output contract behind one dedicated module', () => {
    expect(modelModalPropsContractSource).toContain("import type { ComponentProps } from 'react'")
    expect(modelModalPropsContractSource).toContain("import type ChannelsPageModelConfigModal from '../components/ChannelsPageModelConfigModal'")
    expect(modelModalPropsContractSource).toContain("import type { ChannelsPageChannelInfo } from './channels-page-data-contract'")
    expect(modelModalPropsContractSource).toContain(
      "import type { ChannelsPageModelModalState } from './channels-page-model-config-contract'"
    )
    expect(modelModalPropsContractSource).toContain('export interface ChannelsPageModelModalPropsOptions')
    expect(modelModalPropsContractSource).toContain('export interface ChannelsPageModelModalPropsResult {')
  })

  it('reuses the shared model modal state contract for model modal props wiring', () => {
    expect(modelModalPropsContractSource).toContain(
      'export interface ChannelsPageModelModalPropsOptions'
    )
    expect(modelModalPropsContractSource).toContain(
      'extends ChannelsPageModelModalState<ChannelsPageChannelInfo> {}'
    )
    expect(modelModalPropsContractSource).toContain('modelConfigModalProps: ComponentProps<typeof ChannelsPageModelConfigModal>')
  })
})
