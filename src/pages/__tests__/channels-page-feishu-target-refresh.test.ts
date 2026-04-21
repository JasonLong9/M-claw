import { describe, expect, it } from 'vitest'

import feishuTargetRefreshSource from '../channels-page-feishu-target-refresh.ts?raw'

describe('channels-page-feishu-target-refresh hook', () => {
  it('keeps the shared target-refresh controller contract for pairing-key derivation and guarded refresh state', () => {
    expect(feishuTargetRefreshSource).toContain("import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'")
    expect(feishuTargetRefreshSource).toContain("import type { ChannelPairingTargetRef } from './channels-page-utils'")
    expect(feishuTargetRefreshSource).toContain('ChannelsPageFeishuTargetRefreshOptions,')
    expect(feishuTargetRefreshSource).toContain('ChannelsPageFeishuTargetRefreshResult,')
    expect(feishuTargetRefreshSource).toContain('FeishuTargetRefreshBindings,')
    expect(feishuTargetRefreshSource).toContain("} from './channels-page-feishu-target-refresh-contract'")
    expect(feishuTargetRefreshSource).toContain('export function getFeishuTargetPairingKey(')
    expect(feishuTargetRefreshSource).toContain('target: ChannelPairingTargetRef | null | undefined')
    expect(feishuTargetRefreshSource).toContain('export function useChannelsPageFeishuTargetRefresh({')
    expect(feishuTargetRefreshSource).toContain('}: ChannelsPageFeishuTargetRefreshOptions): ChannelsPageFeishuTargetRefreshResult {')
    expect(feishuTargetRefreshSource).toContain('const [refreshingTargetChannel, setRefreshingTargetChannel] = useState(false)')
    expect(feishuTargetRefreshSource).toContain("const [checkedTargetKey, setCheckedTargetKey] = useState('')")
    expect(feishuTargetRefreshSource).toContain('const requestIdRef = useRef(0)')
    expect(feishuTargetRefreshSource).toContain('const pairingKey = getFeishuTargetPairingKey(target)')
    expect(feishuTargetRefreshSource).toContain('const refreshChannelsRef = useRef(refreshChannels)')
    expect(feishuTargetRefreshSource).not.toContain('interface FeishuTargetRefreshBindings {')
  })

  it('preserves the guarded refresh lifecycle so each modal can reuse one refresh implementation', () => {
    expect(feishuTargetRefreshSource).toContain('function resetFeishuTargetRefresh(bindings: FeishuTargetRefreshBindings): void {')
    expect(feishuTargetRefreshSource).toContain('async function runGuardedFeishuTargetRefresh(')
    expect(feishuTargetRefreshSource).toContain('async function refreshFeishuTargetChannelStatus(')
    expect(feishuTargetRefreshSource).toContain('function runFeishuTargetRefreshLifecycle(')
    expect(feishuTargetRefreshSource).toContain('bindings.requestIdRef.current = requestId')
    expect(feishuTargetRefreshSource).toContain('if (bindings.requestIdRef.current !== requestId) return')
    expect(feishuTargetRefreshSource).toContain('() => refreshChannelsRef.current()')
    expect(feishuTargetRefreshSource).toContain('() => runFeishuTargetRefreshLifecycle(')
    expect(feishuTargetRefreshSource).toContain('refreshTargetChannelStatus')
    expect(feishuTargetRefreshSource).toContain('checkedTargetKey,')
  })
})
