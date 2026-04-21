import { describe, expect, it } from 'vitest'

import modelConfigControllerSource from '../channels-page-model-config.ts?raw'

describe('channels-page-model-config controller', () => {
  it('keeps the shared model-config controller contract for modal state, caching, and selected-channel syncing', () => {
    expect(modelConfigControllerSource).toContain("import { useRef, useState } from 'react'")
    expect(modelConfigControllerSource).toContain('applyAgentPrimaryModelWithGatewayReload,')
    expect(modelConfigControllerSource).toContain('extractPrimaryModelFromModelStatusPayload,')
    expect(modelConfigControllerSource).toContain("import { readOpenClawUpstreamModelState } from '../shared/upstream-model-state'")
    expect(modelConfigControllerSource).toContain('ensureModelSelectOption,')
    expect(modelConfigControllerSource).toContain('loadReadyModelSelectOptions,')
    expect(modelConfigControllerSource).toContain('ChannelsPageModelConfigChannel,')
    expect(modelConfigControllerSource).toContain('ChannelsPageModelConfigOptions,')
    expect(modelConfigControllerSource).toContain('ChannelsPageModelConfigResult,')
    expect(modelConfigControllerSource).toContain("} from './channels-page-model-config-contract'")
    expect(modelConfigControllerSource).toContain('export function shouldReuseModelOptionsCache(')
    expect(modelConfigControllerSource).toContain('export function useChannelsPageModelConfig<Channel extends ChannelsPageModelConfigChannel>({')
    expect(modelConfigControllerSource).toContain('}: ChannelsPageModelConfigOptions<Channel>): ChannelsPageModelConfigResult<Channel> {')
    expect(modelConfigControllerSource).toContain('const modelOptionsCacheRef = useRef<ModelSelectOption[]>([])')
    expect(modelConfigControllerSource).toContain('const syncSelectedModelChannelSnapshot = (nextChannels: Channel[]) => {')
    expect(modelConfigControllerSource).not.toContain('interface UseChannelsPageModelConfigOptions<Channel extends ChannelsPageModelConfigChannel> {')
  })

  it('reuses the shared model catalog path, loads env snapshots, and saves through the gateway reload flow', () => {
    expect(modelConfigControllerSource).toContain('const loadModelOptions = async (options?: {')
    expect(modelConfigControllerSource).toContain('window.api.readEnvFile().catch(() => null)')
    expect(modelConfigControllerSource).toContain("mode: 'all'")
    expect(modelConfigControllerSource).toContain('preferredModelKey: nextRuntimeModel,')
    expect(modelConfigControllerSource).toContain('nextOptions = ensureModelSelectOption(nextOptions, nextRuntimeModel)')
    expect(modelConfigControllerSource).toContain('const result = await applyAgentPrimaryModelWithGatewayReload({')
    expect(modelConfigControllerSource).toContain('closeModelModal({ force: true })')
    expect(modelConfigControllerSource).toContain("await fetchChannels({ background: true })")
  })
})
