import { describe, expect, it } from 'vitest'

import modelConfigContractSource from '../channels-page-model-config-contract.ts?raw'

describe('channels-page-model-config-contract module', () => {
  it('keeps the model-config input and output contract behind one dedicated module', () => {
    expect(modelConfigContractSource).toContain("import type { Dispatch, SetStateAction } from 'react'")
    expect(modelConfigContractSource).toContain(
      "import type { ChannelsPageAsyncChannelActionHandler } from './channels-page-channel-actions-contract'"
    )
    expect(modelConfigContractSource).toContain("import type {")
    expect(modelConfigContractSource).toContain('ChannelsPageAgentBinding,')
    expect(modelConfigContractSource).toContain('ChannelsPageAsyncVoidHandler,')
    expect(modelConfigContractSource).toContain('ChannelsPageChannelIdentityBinding,')
    expect(modelConfigContractSource).toContain('ChannelsPageChannelNameBinding,')
    expect(modelConfigContractSource).toContain('ChannelsPageChannelSnapshotsSyncHandler,')
    expect(modelConfigContractSource).toContain('ChannelsPageNullableChannel,')
    expect(modelConfigContractSource).toContain('ChannelsPageNullableStringSetter,')
    expect(modelConfigContractSource).toContain("} from './channels-page-data-contract'")
    expect(modelConfigContractSource).toContain("import type { ModelSelectOption } from './channels-page-model-options'")
    expect(modelConfigContractSource).toContain(
      "import type { ChannelsPageLatestChannelSnapshotAccessBinding } from './channels-page-state-helpers-contract'"
    )
    expect(modelConfigContractSource).toContain('export interface ChannelsPageModelConfigChannel')
    expect(modelConfigContractSource).toContain('export interface ChannelsPageModelConfigOptions<Channel extends ChannelsPageModelConfigChannel>')
    expect(modelConfigContractSource).toContain('export interface ChannelsPageModelModalState<Channel> {')
    expect(modelConfigContractSource).toContain(
      'export interface ChannelsPageModelConfigResult<Channel extends ChannelsPageModelConfigChannel>'
    )
    expect(modelConfigContractSource).toContain('extends ChannelsPageLatestChannelSnapshotAccessBinding<Channel> {}')
  })

  it('keeps the shared model modal state plus model-config actions in the shared contract module', () => {
    expect(modelConfigContractSource).toContain('ChannelsPageLatestChannelSnapshotAccessBinding<Channel> {}')
    expect(modelConfigContractSource).toContain('extends ChannelsPageChannelIdentityBinding,')
    expect(modelConfigContractSource).toContain('ChannelsPageChannelNameBinding,')
    expect(modelConfigContractSource).toContain('ChannelsPageAgentBinding {}')
    expect(modelConfigContractSource).toContain('export interface ChannelsPageModelModalState<Channel> {')
    expect(modelConfigContractSource).toContain('showModelModal: boolean')
    expect(modelConfigContractSource).toContain('selectedModelChannel: ChannelsPageNullableChannel<Channel>')
    expect(modelConfigContractSource).toContain('modelOptions: ModelSelectOption[]')
    expect(modelConfigContractSource).toContain('selectedModelValue: string | null')
    expect(modelConfigContractSource).toContain('currentRuntimeModel: string | null')
    expect(modelConfigContractSource).toContain('modelModalError: string')
    expect(modelConfigContractSource).toContain('loadingModelContext: boolean')
    expect(modelConfigContractSource).toContain('savingModel: boolean')
    expect(modelConfigContractSource).toContain('setSelectedModelValue: ChannelsPageNullableStringSetter')
    expect(modelConfigContractSource).toContain('closeModelModal: (options?: { force?: boolean }) => void')
    expect(modelConfigContractSource).toContain('handleSaveBotModel: ChannelsPageAsyncVoidHandler')
    expect(modelConfigContractSource).toContain('extends ChannelsPageModelModalState<Channel> {')
    expect(modelConfigContractSource).toContain(
      'handleOpenModelConfig: ChannelsPageAsyncChannelActionHandler<Channel>'
    )
    expect(modelConfigContractSource).toContain(
      'syncSelectedModelChannelSnapshot: ChannelsPageChannelSnapshotsSyncHandler<Channel>'
    )
  })
})
