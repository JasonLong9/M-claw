import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Button, Card, Group, Loader, Modal, Select, Stack, Text } from '@mantine/core'
import FeishuSharedStatusAlert, { type FeishuSharedStatusAlertState } from './FeishuSharedStatusAlert'

import type {
  FeishuBotDiagnosticListenResult,
  FeishuBotDiagnosticSendResult,
} from '../shared/feishu-diagnostics'

export interface FeishuDiagnosticsRepairOutcome {
  ok: boolean
  message: string
}

interface FeishuDiagnosticsModalProps {
  opened: boolean
  onClose: () => void
  accountId: string
  botLabel: string
  agentId?: string
  sharedStatusAlert?: FeishuSharedStatusAlertState | null
  repairingSharedStatus?: boolean
  onRepairSharedStatus?: (() => Promise<FeishuDiagnosticsRepairOutcome>) | null
}

interface PairedFeishuAccount {
  openId: string
  name: string
}

function getAlertColor(result: { ok: boolean; detected?: boolean }): string {
  if (!result.ok) return 'red'
  if (typeof result.detected === 'boolean') {
    return result.detected ? 'green' : 'yellow'
  }
  return 'green'
}

function formatDuration(waitedMs: number): string {
  if (!Number.isFinite(waitedMs) || waitedMs <= 0) return '0 秒'
  return `${Math.max(1, Math.round(waitedMs / 1000))} 秒`
}

export default function FeishuDiagnosticsModal({
  opened,
  onClose,
  accountId,
  botLabel,
  agentId,
  sharedStatusAlert,
  repairingSharedStatus = false,
  onRepairSharedStatus,
}: FeishuDiagnosticsModalProps) {
  const [pairedAccounts, setPairedAccounts] = useState<PairedFeishuAccount[]>([])
  const [loadingAccounts, setLoadingAccounts] = useState(false)
  const [accountsError, setAccountsError] = useState('')
  const [selectedOpenId, setSelectedOpenId] = useState<string | null>(null)
  const [listening, setListening] = useState(false)
  const [sending, setSending] = useState(false)
  const [listenResult, setListenResult] = useState<FeishuBotDiagnosticListenResult | null>(null)
  const [sendResult, setSendResult] = useState<FeishuBotDiagnosticSendResult | null>(null)
  const [repairResult, setRepairResult] = useState<FeishuDiagnosticsRepairOutcome | null>(null)
  const mountedRef = useRef(true)
  const activeListenRequestIdRef = useRef<string | null>(null)
  const pairedAccountsLoadVersionRef = useRef(0)
  const probeBlockedBySharedStatus = Boolean(sharedStatusAlert)

  const loadPairedAccounts = useCallback(async () => {
    const loadVersion = pairedAccountsLoadVersionRef.current + 1
    pairedAccountsLoadVersionRef.current = loadVersion
    setAccountsError('')
    setLoadingAccounts(true)

    try {
      const accounts = await window.api.pairingFeishuAccounts(accountId)
      if (!mountedRef.current || pairedAccountsLoadVersionRef.current !== loadVersion) return
      const normalized = Array.isArray(accounts) ? accounts : []
      setPairedAccounts(normalized)
      setSelectedOpenId((current) => {
        if (current && normalized.some((item) => item.openId === current)) return current
        return normalized[0]?.openId || null
      })
    } catch (error) {
      if (!mountedRef.current || pairedAccountsLoadVersionRef.current !== loadVersion) return
      setPairedAccounts([])
      setSelectedOpenId(null)
      setAccountsError(error instanceof Error ? error.message : '加载已配对飞书账号失败。')
    } finally {
      if (!mountedRef.current || pairedAccountsLoadVersionRef.current !== loadVersion) return
      setLoadingAccounts(false)
    }
  }, [accountId])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      const requestId = activeListenRequestIdRef.current
      activeListenRequestIdRef.current = null
      if (requestId) {
        void window.api.cancelFeishuBotDiagnosticListen(requestId).catch(() => undefined)
      }
    }
  }, [])

  useEffect(() => {
    if (!opened) return

    setListenResult(null)
    setSendResult(null)
    setRepairResult(null)
    void loadPairedAccounts()
  }, [opened, loadPairedAccounts])

  const pairedAccountOptions = useMemo(
    () =>
      pairedAccounts.map((item) => ({
        value: item.openId,
        label: item.name ? `${item.name} (${item.openId})` : item.openId,
      })),
    [pairedAccounts]
  )

  const selectedRecipient = pairedAccounts.find((item) => item.openId === selectedOpenId) || null

  const cancelActiveListen = () => {
    const requestId = activeListenRequestIdRef.current
    activeListenRequestIdRef.current = null
    if (requestId) {
      void window.api.cancelFeishuBotDiagnosticListen(requestId).catch(() => undefined)
    }
    if (mountedRef.current) {
      setListening(false)
    }
  }

  const handleClose = () => {
    cancelActiveListen()
    onClose()
  }

  const handleListen = async () => {
    if (probeBlockedBySharedStatus) return
    const startedAt = new Date().toISOString()
    const requestId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `feishu-diagnostic-${Date.now()}-${Math.random().toString(16).slice(2)}`
    activeListenRequestIdRef.current = requestId
    setListening(true)
    setListenResult(null)
    try {
      const result = await window.api.listenFeishuBotDiagnosticActivity(accountId, 60_000, requestId)
      if (!mountedRef.current || activeListenRequestIdRef.current !== requestId) return
      setListenResult(result)
    } catch (error) {
      if (!mountedRef.current || activeListenRequestIdRef.current !== requestId) return
      setListenResult({
        ok: false,
        detected: false,
        accountId,
        activityKind: 'none',
        summary: '监听当前机器人活动失败，请稍后重试。',
        startedAt,
        endedAt: new Date().toISOString(),
        timeoutMs: 60_000,
        waitedMs: 0,
        code: 1,
        stderr: error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (activeListenRequestIdRef.current === requestId) {
        activeListenRequestIdRef.current = null
      }
      if (mountedRef.current) {
        setListening(false)
      }
    }
  }

  const handleSend = async () => {
    if (probeBlockedBySharedStatus) return
    if (!selectedOpenId) return
    const sentAt = new Date().toISOString()
    setSending(true)
    setSendResult(null)
    try {
      const result = await window.api.sendFeishuDiagnosticMessage({
        accountId,
        openId: selectedOpenId,
        recipientName: selectedRecipient?.name,
        botLabel,
      })
      if (!mountedRef.current) return
      setSendResult(result)
    } catch (error) {
      if (!mountedRef.current) return
      setSendResult({
        ok: false,
        accountId,
        openId: selectedOpenId,
        recipientName: selectedRecipient?.name,
        botLabel,
        agentId: agentId || 'unknown-agent',
        machineLabel: 'unknown-machine',
        traceId: 'trace-unavailable',
        sentAt,
        sentText: '',
        summary: '发送诊断消息失败，请稍后重试。',
        code: 1,
        stderr: error instanceof Error ? error.message : String(error),
      })
    } finally {
      if (mountedRef.current) {
        setSending(false)
      }
    }
  }

  const handleRepairSharedStatus = async () => {
    if (!onRepairSharedStatus || repairingSharedStatus) return

    cancelActiveListen()
    setListenResult(null)
    setSendResult(null)
    setRepairResult(null)

    try {
      const result = await onRepairSharedStatus()
      if (!mountedRef.current) return
      setRepairResult(result)
      await loadPairedAccounts()
    } catch (error) {
      if (!mountedRef.current) return
      setRepairResult({
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={handleClose}
      title={`${botLabel} 诊断`}
      size="lg"
    >
      <Stack gap="md">
        <Alert color="blue" variant="light" title="当前目标">
          <Text size="sm">机器人：{botLabel}</Text>
          <Text size="sm">accountId：{accountId}</Text>
          {agentId && <Text size="sm">代理：{agentId}</Text>}
        </Alert>

        {sharedStatusAlert && (
          <FeishuSharedStatusAlert
            alert={sharedStatusAlert}
            repairHint="可直接在这里修复共享飞书状态；修复并刷新后，再继续下面的诊断探测。"
            repairing={repairingSharedStatus}
            repairDisabled={listening || sending}
            onRepair={onRepairSharedStatus ? () => void handleRepairSharedStatus() : null}
          />
        )}

        {repairResult && (
          <Alert
            color={repairResult.ok ? 'green' : 'red'}
            variant="light"
            title={repairResult.ok ? '修复结果' : '修复失败'}
          >
            <Text size="sm">{repairResult.message}</Text>
          </Alert>
        )}

        <Card withBorder padding="md">
          <Stack gap="sm">
            <div>
              <Text fw={600}>监听下一条机器人入站活动</Text>
              <Text size="sm" c="dimmed">
                开始监听后，请立刻在飞书里给这个机器人发送一条消息。Mclaw 会监听当前机器上的本地活动，
                用来确认事件是否真的落在这台机器上。
              </Text>
            </div>

            <Group justify="space-between" align="center">
              <Text size="xs" c="dimmed">监听窗口：60 秒</Text>
              <Button
                onClick={() => void handleListen()}
                loading={listening}
                disabled={sending || probeBlockedBySharedStatus}
              >
                开始监听下一条消息
              </Button>
            </Group>

            {probeBlockedBySharedStatus && (
              <Alert color="yellow" variant="light" title="探测已阻塞">
                <Text size="sm">请先解除共享飞书阻塞状态，再重新运行监听 / 发送探测。</Text>
              </Alert>
            )}

            {listening && (
              <Group gap="xs">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">
                  正在监听这台机器上的本地机器人活动，现在请去飞书发送消息。
                </Text>
              </Group>
            )}

            {listenResult && (
              <Alert color={getAlertColor(listenResult)} variant="light" title="监听结果">
                <Text size="sm">{listenResult.summary}</Text>
                <Text size="xs" c="dimmed">耗时：{formatDuration(listenResult.waitedMs)}</Text>
                {listenResult.evidencePath && (
                  <Text size="xs" c="dimmed" style={{ wordBreak: 'break-all' }}>
                    证据路径：{listenResult.evidencePath}
                  </Text>
                )}
                {!listenResult.ok && listenResult.stderr && (
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                    错误详情：{listenResult.stderr}
                  </Text>
                )}
              </Alert>
            )}
          </Stack>
        </Card>

        <Card withBorder padding="md">
          <Stack gap="sm">
            <div>
              <Text fw={600}>发送定位诊断消息</Text>
              <Text size="sm" c="dimmed">
                让这个机器人向已配对用户发送一条消息，用来确认实际发出消息的是哪台机器、哪个机器人，以及
                trace id。
              </Text>
            </div>

            {accountsError && (
              <Alert color="red" variant="light" title="加载已配对账号失败">
                <Text size="sm">{accountsError}</Text>
              </Alert>
            )}

            {loadingAccounts ? (
              <Group gap="xs">
                <Loader size="sm" />
                <Text size="sm" c="dimmed">正在加载已配对的飞书账号...</Text>
              </Group>
            ) : pairedAccountOptions.length > 0 ? (
              <>
                <Select
                  label="接收人"
                  placeholder="选择一个已配对的飞书用户"
                  data={pairedAccountOptions}
                  value={selectedOpenId}
                  onChange={setSelectedOpenId}
                  disabled={probeBlockedBySharedStatus || sending}
                  searchable
                  nothingFoundMessage="没有匹配的已配对用户"
                />
                <Group justify="space-between" align="center">
                  <Text size="xs" c="dimmed">
                    消息会包含机器人、accountId、agentId、机器标识和 trace id。
                  </Text>
                  <Button
                    onClick={() => void handleSend()}
                    loading={sending}
                    disabled={!selectedOpenId || listening || probeBlockedBySharedStatus}
                  >
                    发送诊断消息
                  </Button>
                </Group>
              </>
            ) : (
              <Alert color="yellow" variant="light" title="暂无已配对用户">
                <Text size="sm">这个机器人还没有已配对用户，因此暂时无法发送诊断消息。</Text>
              </Alert>
            )}

            {sendResult && (
              <Alert color={getAlertColor(sendResult)} variant="light" title="发送结果">
                <Text size="sm">{sendResult.summary}</Text>
                <Text size="xs" c="dimmed">traceId：{sendResult.traceId}</Text>
                {sendResult.messageId && <Text size="xs" c="dimmed">messageId：{sendResult.messageId}</Text>}
                {!sendResult.ok && sendResult.stderr && (
                  <Text size="xs" c="dimmed" style={{ whiteSpace: 'pre-wrap' }}>
                    错误详情：{sendResult.stderr}
                  </Text>
                )}
              </Alert>
            )}
          </Stack>
        </Card>
      </Stack>
    </Modal>
  )
}
