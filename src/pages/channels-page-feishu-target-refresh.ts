import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from 'react'

import type { ChannelPairingTargetRef } from './channels-page-utils'
import type {
  ChannelsPageFeishuTargetRefreshOptions,
  ChannelsPageFeishuTargetRefreshResult,
  FeishuTargetRefreshBindings,
} from './channels-page-feishu-target-refresh-contract'

function resetFeishuTargetRefresh(bindings: FeishuTargetRefreshBindings): void {
  bindings.requestIdRef.current += 1
  bindings.setRefreshing(false)
  bindings.setCheckedKey('')
}

async function runGuardedFeishuTargetRefresh(
  bindings: FeishuTargetRefreshBindings,
  pairingKey: string,
  refresh: () => Promise<unknown>
): Promise<void> {
  const requestId = bindings.requestIdRef.current + 1
  bindings.requestIdRef.current = requestId
  bindings.setRefreshing(true)
  bindings.setCheckedKey('')

  try {
    await refresh()
  } finally {
    if (bindings.requestIdRef.current !== requestId) return
    bindings.setRefreshing(false)
    bindings.setCheckedKey(pairingKey)
  }
}

async function refreshFeishuTargetChannelStatus(
  bindings: FeishuTargetRefreshBindings,
  pairingKey: string,
  refresh: () => Promise<unknown>
): Promise<void> {
  await runGuardedFeishuTargetRefresh(bindings, pairingKey, refresh)
}

function runFeishuTargetRefreshLifecycle(
  active: boolean,
  pairingKey: string,
  bindings: FeishuTargetRefreshBindings,
  refreshTargetChannelStatus: (pairingKey: string) => Promise<void>
): (() => void) | void {
  if (!active || !pairingKey) {
    resetFeishuTargetRefresh(bindings)
    return
  }

  void refreshTargetChannelStatus(pairingKey)

  return () => {
    resetFeishuTargetRefresh(bindings)
  }
}

export function getFeishuTargetPairingKey(
  target: ChannelPairingTargetRef | null | undefined
): string {
  return target?.channelId === 'feishu' && target.accountId
    ? `feishu:${target.accountId}`
    : ''
}

export function useChannelsPageFeishuTargetRefresh({
  active,
  target,
  refreshChannels,
}: ChannelsPageFeishuTargetRefreshOptions): ChannelsPageFeishuTargetRefreshResult {
  const [refreshingTargetChannel, setRefreshingTargetChannel] = useState(false)
  const [checkedTargetKey, setCheckedTargetKey] = useState('')
  const requestIdRef = useRef(0)
  const refreshChannelsRef = useRef(refreshChannels)
  refreshChannelsRef.current = refreshChannels

  const pairingKey = getFeishuTargetPairingKey(target)
  const bindings = useMemo<FeishuTargetRefreshBindings>(() => ({
    requestIdRef,
    setRefreshing: setRefreshingTargetChannel,
    setCheckedKey: setCheckedTargetKey,
  }), [])

  const refreshTargetChannelStatus = useCallback(async (nextPairingKey: string) => {
    await refreshFeishuTargetChannelStatus(
      bindings,
      nextPairingKey,
      () => refreshChannelsRef.current()
    )
  }, [bindings])

  useEffect(
    () => runFeishuTargetRefreshLifecycle(
      active,
      pairingKey,
      bindings,
      refreshTargetChannelStatus
    ),
    [active, bindings, pairingKey, refreshTargetChannelStatus]
  )

  return {
    pairingKey,
    refreshingTargetChannel,
    checkedTargetKey,
    refreshTargetChannelStatus,
  }
}
