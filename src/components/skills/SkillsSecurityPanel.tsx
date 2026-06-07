import { useMemo, useState } from 'react'
import {
  Alert,
  Badge,
  Button,
  Card,
  Divider,
  Group,
  List,
  Modal,
  Paper,
  Progress,
  SimpleGrid,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
} from '@mantine/core'
import {
  IconAlertTriangle,
  IconCheck,
  IconClock,
  IconFileExport,
  IconHistory,
  IconLock,
  IconRefresh,
  IconShieldCheck,
  IconShieldX,
  IconSparkles,
  IconWand,
} from '@tabler/icons-react'

interface SkillsSecurityPanelProps {
  summary: {
    total: number
    allowed: number
    blocked: number
    byErrorCode: Record<string, number>
  } | null
  runtime: {
    riskBySkill: Record<string, number>
    disabledSkills: string[]
    recentEvents: Array<{ skillSlug: string; type: string; detail?: string; timestamp: string }>
  } | null
  auditLatest: any
  auditHistory: any[]
  remediationState: {
    restrictedSkills: string[]
    quarantinedSkills: string[]
    exemptions: Array<{
      skillSlug: string
      reason: string
      reviewer: string
      expiresAt: string
    }>
  } | null
  onRefresh: () => void
  onRunAudit: () => void
  onAutoRemediate: () => void
  onExportAudit: () => void
  onRestoreAllRestricted: () => void
  onRestoreOneSkill: (skillSlug: string) => void
  onAddExemption: (payload: { skillSlug: string; reason: string; reviewer: string; expiresInHours: number }) => void
  onRemoveExemption: (skillSlug: string) => void
}

type OverviewLevel = 'safe' | 'attention' | 'danger'

function formatTime(value: unknown): string {
  const raw = String(value || '').trim()
  return raw || '暂无记录'
}

function formatEventType(type: string): string {
  if (type === 'runtime-disabled') return '运行时自动禁用'
  if (type === 'risk-increased') return '风险分上升'
  if (type === 'execution-blocked') return '命中阻断规则'
  return '出现新的安全事件'
}

function formatEventSummary(event: { skillSlug: string; type: string; detail?: string; timestamp: string }): string {
  const detail = String(event.detail || '').trim()
  if (detail) return `${event.skillSlug}: ${detail}`
  return `${event.skillSlug}: ${formatEventType(event.type)}`
}

function safeHoursInput(value: string): number {
  const hours = Number.parseInt(value, 10)
  if (!Number.isFinite(hours) || hours <= 0) return 24
  return hours
}

export default function SkillsSecurityPanel(props: SkillsSecurityPanelProps) {
  const {
    summary,
    runtime,
    auditLatest,
    auditHistory,
    remediationState,
    onRefresh,
    onRunAudit,
    onAutoRemediate,
    onExportAudit,
    onRestoreAllRestricted,
    onRestoreOneSkill,
    onAddExemption,
    onRemoveExemption,
  } = props

  const [skillSlug, setSkillSlug] = useState('')
  const [reason, setReason] = useState('')
  const [reviewer, setReviewer] = useState('')
  const [expiresHours, setExpiresHours] = useState('24')
  const [wizardOpened, setWizardOpened] = useState(false)
  const [wizardStep, setWizardStep] = useState(0)
  const [wizardExecuted, setWizardExecuted] = useState(false)

  const restrictedSkills = remediationState?.restrictedSkills || []
  const quarantinedSkills = remediationState?.quarantinedSkills || []
  const runtimeDisabledSkills = runtime?.disabledSkills || []
  const recentEvents = runtime?.recentEvents || []
  const exemptions = remediationState?.exemptions || []
  const changedSkills = auditLatest?.delta?.changedSkills?.length || 0

  const limitedSkills = useMemo(
    () => Array.from(new Set([...quarantinedSkills, ...restrictedSkills, ...runtimeDisabledSkills])),
    [quarantinedSkills, restrictedSkills, runtimeDisabledSkills]
  )

  const overview = useMemo(() => {
    const hasDanger = quarantinedSkills.length > 0 || runtimeDisabledSkills.length > 0
    const hasAttention = restrictedSkills.length > 0 || changedSkills > 0 || (summary?.blocked || 0) > 0
    const level: OverviewLevel = hasDanger ? 'danger' : hasAttention ? 'attention' : 'safe'
    const color = level === 'danger' ? 'red' : level === 'attention' ? 'yellow' : 'teal'
    const scoreBase = Math.max(summary?.total || 0, 1)
    const issueCount = limitedSkills.length + (summary?.blocked || 0)
    const progress = level === 'safe' ? 12 : Math.min(100, Math.max(22, Math.round((issueCount / scoreBase) * 100)))

    if (level === 'danger') {
      return {
        level,
        color,
        progress,
        badge: '高风险',
        title: '发现需要立刻处理的技能风险',
        description: '有技能已被隔离、限制或运行时禁用。建议先执行自动修复，再决定是否恢复单个技能。',
      }
    }

    if (level === 'attention') {
      return {
        level,
        color,
        progress,
        badge: '需关注',
        title: '当前有待确认的风险或变更',
        description: '最近出现了技能变更、阻断或限制。建议先重新巡检，确认哪些问题需要处理。',
      }
    }

    return {
      level,
      color,
      progress,
      badge: '安全',
      title: '当前未发现明显风险',
      description: '整体状态稳定。保持定期巡检即可，通常不需要手动干预。',
    }
  }, [
    changedSkills,
    limitedSkills.length,
    quarantinedSkills.length,
    restrictedSkills.length,
    runtimeDisabledSkills.length,
    summary?.blocked,
    summary?.total,
  ])

  const topReasons = useMemo(() => {
    const reasons: string[] = []
    if (quarantinedSkills.length > 0) reasons.push(`有 ${quarantinedSkills.length} 个技能已被隔离`)
    if (restrictedSkills.length > 0) reasons.push(`有 ${restrictedSkills.length} 个技能处于受限状态`)
    if (runtimeDisabledSkills.length > 0) reasons.push(`有 ${runtimeDisabledSkills.length} 个技能被运行时禁用`)
    if (changedSkills > 0) reasons.push(`最近巡检发现 ${changedSkills} 个技能发生变化`)
    if ((summary?.blocked || 0) > 0) reasons.push(`静态扫描拦截了 ${summary?.blocked || 0} 个风险项`)
    if (reasons.length === 0) reasons.push('当前没有需要优先处理的风险项')
    return reasons.slice(0, 4)
  }, [changedSkills, quarantinedSkills.length, restrictedSkills.length, runtimeDisabledSkills.length, summary?.blocked])

  const quickGuide = useMemo(() => {
    if (overview.level === 'danger') {
      return [
        '先点“一键修复”，让系统先收敛明显风险。',
        '修复后再看“受限技能”列表，按需要恢复单个技能。',
        '只有确认业务必须放行时，再去添加临时豁免。',
      ]
    }

    if (overview.level === 'attention') {
      return [
        '先点“重新巡检”，确认问题是否仍然存在。',
        '如果只是误报，再去管理豁免，避免直接放大风险。',
        '巡检结果稳定后，再决定是否恢复技能。',
      ]
    }

    return [
      '保持定期刷新或巡检，避免风险堆积。',
      '新增技能后，建议先巡检一次再正式使用。',
      '只有临时业务需要时才使用豁免，并写清原因。',
    ]
  }, [overview.level])

  const remediationChecklist = useMemo(() => {
    const items: string[] = []
    if (quarantinedSkills.length > 0) items.push(`隔离技能 ${quarantinedSkills.length} 个`)
    if (restrictedSkills.length > 0) items.push(`受限技能 ${restrictedSkills.length} 个`)
    if (runtimeDisabledSkills.length > 0) items.push(`运行时禁用技能 ${runtimeDisabledSkills.length} 个`)
    if ((summary?.blocked || 0) > 0) items.push(`静态阻断项 ${summary?.blocked || 0} 个`)
    if (items.length === 0) items.push('当前没有必须立即修复的高风险项')
    return items
  }, [quarantinedSkills.length, restrictedSkills.length, runtimeDisabledSkills.length, summary?.blocked])

  const recommendedAction = useMemo(() => {
    if (quarantinedSkills.length > 0 || runtimeDisabledSkills.length > 0) {
      return {
        title: '推荐先做：一键自动修复',
        description: '系统已经识别到高风险技能。先让系统做收敛，再看是否需要逐个恢复。',
        primaryLabel: '打开修复向导',
        secondaryLabel: '恢复全部受限技能',
        primaryAction: () => {
          setWizardExecuted(false)
          setWizardStep(0)
          setWizardOpened(true)
        },
        secondaryAction: onRestoreAllRestricted,
        icon: IconWand,
        color: 'red' as const,
      }
    }

    if (restrictedSkills.length > 0 || changedSkills > 0 || (summary?.blocked || 0) > 0) {
      return {
        title: '推荐先做：重新巡检',
        description: '当前更像是待确认问题，未必需要直接恢复或豁免。先重新巡检，让系统给出最新判断。',
        primaryLabel: '重新巡检',
        secondaryLabel: '导出报告',
        primaryAction: onRunAudit,
        secondaryAction: onExportAudit,
        icon: IconSparkles,
        color: 'yellow' as const,
      }
    }

    return {
      title: '推荐先做：保持定期巡检',
      description: '当前状态正常。你可以刷新状态或导出报告留档，不需要额外修复。',
      primaryLabel: '刷新状态',
      secondaryLabel: '导出报告',
      primaryAction: onRefresh,
      secondaryAction: onExportAudit,
      icon: IconShieldCheck,
      color: 'teal' as const,
    }
  }, [
    changedSkills,
    onExportAudit,
    onRefresh,
    onRestoreAllRestricted,
    onRunAudit,
    quarantinedSkills.length,
    restrictedSkills.length,
    runtimeDisabledSkills.length,
    summary?.blocked,
  ])

  const canAddExemption =
    skillSlug.trim().length > 0 && reason.trim().length > 0 && reviewer.trim().length > 0

  const wizardProgress = wizardStep === 0 ? 33 : wizardStep === 1 ? 66 : 100

  const closeWizard = () => {
    setWizardOpened(false)
    setWizardStep(0)
    setWizardExecuted(false)
  }

  const runWizardRemediation = () => {
    onAutoRemediate()
    setWizardExecuted(true)
    setWizardStep(2)
  }

  if (!summary && !runtime && !auditLatest && !remediationState) return null

  return (
    <>
      <Paper withBorder radius="lg" p="md" mb="md">
        <Group justify="space-between" align="flex-start" mb="md">
          <div>
            <Text size="lg" fw={800}>Skills 风险概览</Text>
            <Text size="sm" c="dimmed">
              先看当前风险，再按推荐操作处理，最后在下方进入高级管理。
            </Text>
          </div>
          <Group gap={8}>
            <Button size="compact-sm" variant="subtle" leftSection={<IconRefresh size={14} />} onClick={onRefresh}>
              刷新
            </Button>
            <Button size="compact-sm" variant="light" leftSection={<IconSparkles size={14} />} onClick={onRunAudit}>
              重新巡检
            </Button>
            <Button
              size="compact-sm"
              variant="filled"
              color="orange"
              leftSection={<IconWand size={14} />}
              onClick={() => {
                setWizardExecuted(false)
                setWizardStep(0)
                setWizardOpened(true)
              }}
            >
              一键修复
            </Button>
            <Button size="compact-sm" variant="light" onClick={onRestoreAllRestricted}>
              恢复受限技能
            </Button>
            <Button
              size="compact-sm"
              variant="subtle"
              leftSection={<IconFileExport size={14} />}
              onClick={onExportAudit}
            >
              导出报告
            </Button>
          </Group>
        </Group>

        <Card withBorder radius="lg" padding="lg" mb="md">
          <Group justify="space-between" align="flex-start" mb="sm">
            <Group gap="sm" align="flex-start">
              <ThemeIcon size={44} radius="xl" color={overview.color} variant="light">
                {overview.level === 'danger' ? (
                  <IconShieldX size={22} />
                ) : overview.level === 'attention' ? (
                  <IconAlertTriangle size={22} />
                ) : (
                  <IconShieldCheck size={22} />
                )}
              </ThemeIcon>
              <div>
                <Group gap="xs" mb={4}>
                  <Text size="md" fw={800}>{overview.title}</Text>
                  <Badge color={overview.color} variant="light">
                    {overview.badge}
                  </Badge>
                </Group>
                <Text size="sm" c="dimmed">{overview.description}</Text>
              </div>
            </Group>
            <Text size="xs" c="dimmed">最近巡检：{formatTime(auditLatest?.auditedAt)}</Text>
          </Group>

          <Progress value={overview.progress} color={overview.color} radius="xl" size="md" mb="sm" />

          <List
            size="sm"
            spacing={4}
            icon={
              <ThemeIcon size={18} radius="xl" color={overview.color} variant="light">
                <IconCheck size={12} />
              </ThemeIcon>
            }
          >
            {topReasons.map((item) => (
              <List.Item key={item}>{item}</List.Item>
            ))}
          </List>
        </Card>

        <SimpleGrid cols={{ base: 1, md: 4 }} spacing="sm" mb="md">
          <Card withBorder radius="md" padding="md">
            <Text size="xs" c="dimmed" mb={4}>已巡检技能</Text>
            <Text size="xl" fw={800}>{summary?.total ?? 0}</Text>
            <Badge mt="xs" color="blue" variant="light">
              已放行 {summary?.allowed ?? 0}
            </Badge>
          </Card>
          <Card withBorder radius="md" padding="md">
            <Text size="xs" c="dimmed" mb={4}>待处理技能</Text>
            <Text size="xl" fw={800}>{limitedSkills.length}</Text>
            <Badge mt="xs" color={limitedSkills.length > 0 ? 'red' : 'gray'} variant="light">
              需处理 {limitedSkills.length}
            </Badge>
          </Card>
          <Card withBorder radius="md" padding="md">
            <Text size="xs" c="dimmed" mb={4}>最近变更</Text>
            <Text size="xl" fw={800}>{changedSkills}</Text>
            <Badge mt="xs" color={changedSkills > 0 ? 'yellow' : 'gray'} variant="light">
              本轮发现
            </Badge>
          </Card>
          <Card withBorder radius="md" padding="md">
            <Text size="xs" c="dimmed" mb={4}>临时豁免</Text>
            <Text size="xl" fw={800}>{exemptions.length}</Text>
            <Badge mt="xs" color={exemptions.length > 0 ? 'cyan' : 'gray'} variant="light">
              规则例外
            </Badge>
          </Card>
        </SimpleGrid>

        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md" mb="md">
          <Card withBorder radius="lg" padding="lg">
            <Group justify="space-between" align="flex-start" mb="sm">
              <div>
                <Text size="sm" fw={800}>{recommendedAction.title}</Text>
                <Text size="sm" c="dimmed">{recommendedAction.description}</Text>
              </div>
              <ThemeIcon color={recommendedAction.color} variant="light" radius="xl" size={40}>
                <recommendedAction.icon size={20} />
              </ThemeIcon>
            </Group>
            <Group gap="sm">
              <Button color={recommendedAction.color} onClick={recommendedAction.primaryAction}>
                {recommendedAction.primaryLabel}
              </Button>
              <Button variant="light" onClick={recommendedAction.secondaryAction}>
                {recommendedAction.secondaryLabel}
              </Button>
            </Group>
          </Card>

          <Card withBorder radius="lg" padding="lg">
            <Group gap="sm" mb="sm">
              <ThemeIcon color="indigo" variant="light" radius="xl" size={40}>
                <IconLock size={20} />
              </ThemeIcon>
              <div>
                <Text size="sm" fw={800}>小白操作建议</Text>
                <Text size="sm" c="dimmed">不知道怎么选时，按这个顺序处理，风险最低。</Text>
              </div>
            </Group>
            <List
              size="sm"
              spacing="xs"
              icon={
                <ThemeIcon size={18} radius="xl" color="indigo" variant="light">
                  <IconCheck size={12} />
                </ThemeIcon>
              }
            >
              {quickGuide.map((item) => (
                <List.Item key={item}>{item}</List.Item>
              ))}
            </List>
          </Card>
        </SimpleGrid>

        {recentEvents.length > 0 ? (
          <Alert
            color={overview.level === 'danger' ? 'red' : 'yellow'}
            variant="light"
            title="最近风险事件"
            icon={<IconAlertTriangle size={16} />}
            mb="md"
          >
            <Stack gap={6}>
              {recentEvents.slice(0, 3).map((event) => (
                <div key={`${event.skillSlug}-${event.timestamp}-${event.type}`}>
                  <Text size="sm" fw={600}>{formatEventSummary(event)}</Text>
                  <Text size="xs" c="dimmed">
                    {formatEventType(event.type)} · {formatTime(event.timestamp)}
                  </Text>
                </div>
              ))}
            </Stack>
          </Alert>
        ) : null}

        <Divider my="md" label="高级管理" labelPosition="center" />

        <Tabs defaultValue="limited">
          <Tabs.List>
            <Tabs.Tab value="limited" leftSection={<IconShieldX size={14} />}>
              受限技能
            </Tabs.Tab>
            <Tabs.Tab value="exemptions" leftSection={<IconLock size={14} />}>
              豁免管理
            </Tabs.Tab>
            <Tabs.Tab value="history" leftSection={<IconHistory size={14} />}>
              巡检历史
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="limited" pt="md">
            <Stack gap="sm">
              {limitedSkills.length === 0 ? (
                <Alert color="teal" variant="light" icon={<IconShieldCheck size={16} />}>
                  当前没有受限、隔离或运行时禁用的技能。
                </Alert>
              ) : (
                limitedSkills.map((item) => {
                  const isQuarantined = quarantinedSkills.includes(item)
                  const isRuntimeDisabled = runtimeDisabledSkills.includes(item)
                  const statusText = isQuarantined
                    ? '已隔离'
                    : isRuntimeDisabled
                      ? '运行时禁用'
                      : '受限'

                  return (
                    <Card key={item} withBorder radius="md" padding="md">
                      <Group justify="space-between" align="center">
                        <div>
                          <Text fw={700}>{item}</Text>
                          <Group gap={8} mt={6}>
                            <Badge color={isQuarantined || isRuntimeDisabled ? 'red' : 'yellow'} variant="light">
                              {statusText}
                            </Badge>
                            <Text size="xs" c="dimmed">
                              建议先巡检或修复，再决定是否恢复。
                            </Text>
                          </Group>
                        </div>
                        <Button variant="light" onClick={() => onRestoreOneSkill(item)}>
                          恢复这个技能
                        </Button>
                      </Group>
                    </Card>
                  )
                })
              )}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="exemptions" pt="md">
            <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
              <Card withBorder radius="md" padding="lg">
                <Stack gap="sm">
                  <div>
                    <Text fw={700}>添加临时豁免</Text>
                    <Text size="sm" c="dimmed">
                      只在确认业务必须放行时使用，并尽量写清原因、负责人和有效期。
                    </Text>
                  </div>
                  <TextInput
                    label="技能标识"
                    placeholder="例如：my-skill"
                    value={skillSlug}
                    onChange={(event) => setSkillSlug(event.currentTarget.value)}
                  />
                  <TextInput
                    label="豁免原因"
                    placeholder="例如：内部测试临时放行"
                    value={reason}
                    onChange={(event) => setReason(event.currentTarget.value)}
                  />
                  <TextInput
                    label="负责人"
                    placeholder="例如：James"
                    value={reviewer}
                    onChange={(event) => setReviewer(event.currentTarget.value)}
                  />
                  <TextInput
                    label="有效时长（小时）"
                    placeholder="24"
                    value={expiresHours}
                    onChange={(event) => setExpiresHours(event.currentTarget.value)}
                  />
                  <Button
                    disabled={!canAddExemption}
                    onClick={() =>
                      onAddExemption({
                        skillSlug: skillSlug.trim(),
                        reason: reason.trim(),
                        reviewer: reviewer.trim(),
                        expiresInHours: safeHoursInput(expiresHours),
                      })
                    }
                  >
                    添加豁免
                  </Button>
                </Stack>
              </Card>

              <Card withBorder radius="md" padding="lg">
                <Stack gap="sm">
                  <div>
                    <Text fw={700}>当前豁免列表</Text>
                    <Text size="sm" c="dimmed">这些技能正在临时放行，到期后建议重新巡检。</Text>
                  </div>
                  {exemptions.length === 0 ? (
                    <Alert color="gray" variant="light" icon={<IconClock size={16} />}>
                      当前没有临时豁免。
                    </Alert>
                  ) : (
                    exemptions.map((item) => (
                      <Card key={`${item.skillSlug}-${item.expiresAt}`} withBorder radius="md" padding="sm">
                        <Group justify="space-between" align="flex-start">
                          <div>
                            <Text fw={700}>{item.skillSlug}</Text>
                            <Text size="sm" c="dimmed">原因：{item.reason}</Text>
                            <Text size="xs" c="dimmed">
                              负责人：{item.reviewer} · 到期：{formatTime(item.expiresAt)}
                            </Text>
                          </div>
                          <Button variant="light" color="red" onClick={() => onRemoveExemption(item.skillSlug)}>
                            移除
                          </Button>
                        </Group>
                      </Card>
                    ))
                  )}
                </Stack>
              </Card>
            </SimpleGrid>
          </Tabs.Panel>

          <Tabs.Panel value="history" pt="md">
            <Stack gap="sm">
              {auditHistory.length === 0 ? (
                <Alert color="gray" variant="light" icon={<IconHistory size={16} />}>
                  还没有巡检历史。
                </Alert>
              ) : (
                auditHistory.map((item, index) => (
                  <Card key={`${item?.auditedAt || 'audit'}-${index}`} withBorder radius="md" padding="md">
                    <Group justify="space-between" align="flex-start" mb={6}>
                      <div>
                        <Text fw={700}>巡检时间：{formatTime(item?.auditedAt)}</Text>
                        <Text size="sm" c="dimmed">
                          允许 {item?.summary?.allowed ?? 0} · 阻断 {item?.summary?.blocked ?? 0}
                        </Text>
                      </div>
                      <Badge variant="light" color={(item?.summary?.blocked || 0) > 0 ? 'yellow' : 'teal'}>
                        {(item?.summary?.blocked || 0) > 0 ? '有风险项' : '正常'}
                      </Badge>
                    </Group>
                    <Text size="sm" c="dimmed">
                      本次变化技能数：{item?.delta?.changedSkills?.length || 0}
                    </Text>
                  </Card>
                ))
              )}
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Paper>

      <Modal
        opened={wizardOpened}
        onClose={closeWizard}
        title="一键修复向导"
        centered
        size="lg"
        overlayProps={{ opacity: 0.55, blur: 3 }}
      >
        <Stack gap="md">
          <div>
            <Group justify="space-between" align="center" mb={6}>
              <Text fw={700}>修复流程</Text>
              <Badge variant="light" color={wizardStep === 2 ? 'teal' : 'orange'}>
                第 {wizardStep + 1} 步 / 3 步
              </Badge>
            </Group>
            <Progress value={wizardProgress} color={wizardStep === 2 ? 'teal' : 'orange'} radius="xl" />
          </div>

          {wizardStep === 0 ? (
            <Card withBorder radius="lg" padding="lg">
              <Stack gap="sm">
                <div>
                  <Text fw={700}>第 1 步：确认本次修复范围</Text>
                  <Text size="sm" c="dimmed">
                    先确认这次会处理哪些风险项，避免在不清楚影响范围时直接执行。
                  </Text>
                </div>
                <List
                  size="sm"
                  spacing="xs"
                  icon={
                    <ThemeIcon size={18} radius="xl" color="orange" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  {remediationChecklist.map((item) => (
                    <List.Item key={item}>{item}</List.Item>
                  ))}
                </List>
                <Alert color="yellow" variant="light" icon={<IconAlertTriangle size={16} />}>
                  自动修复更适合先收敛风险，不代表一定恢复所有技能。修复后建议继续检查“受限技能”列表。
                </Alert>
                <Group justify="flex-end">
                  <Button variant="default" onClick={closeWizard}>取消</Button>
                  <Button color="orange" onClick={() => setWizardStep(1)}>
                    我已确认，继续
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : null}

          {wizardStep === 1 ? (
            <Card withBorder radius="lg" padding="lg">
              <Stack gap="sm">
                <div>
                  <Text fw={700}>第 2 步：执行自动修复</Text>
                  <Text size="sm" c="dimmed">
                    点击后会调用系统当前的自动修复逻辑，对高风险技能做收敛处理。
                  </Text>
                </div>
                <SimpleGrid cols={{ base: 1, md: 2 }} spacing="sm">
                  <Card withBorder radius="md" padding="md">
                    <Text fw={600} mb={6}>适合现在修复的情况</Text>
                    <Text size="sm" c="dimmed">已隔离、运行时禁用，或你希望先降低风险再恢复业务。</Text>
                  </Card>
                  <Card withBorder radius="md" padding="md">
                    <Text fw={600} mb={6}>暂不建议直接修复的情况</Text>
                    <Text size="sm" c="dimmed">你还没看清影响范围，或当前只是怀疑误报，应该先重新巡检。</Text>
                  </Card>
                </SimpleGrid>
                <Group justify="space-between">
                  <Button variant="default" onClick={() => setWizardStep(0)}>
                    返回上一步
                  </Button>
                  <Button color="orange" leftSection={<IconWand size={16} />} onClick={runWizardRemediation}>
                    立即执行自动修复
                  </Button>
                </Group>
              </Stack>
            </Card>
          ) : null}

          {wizardStep === 2 ? (
            <Card withBorder radius="lg" padding="lg">
              <Stack gap="sm">
                <div>
                  <Text fw={700}>第 3 步：修复后检查</Text>
                  <Text size="sm" c="dimmed">
                    自动修复命令已经发出。下一步建议按下面顺序做收尾检查。
                  </Text>
                </div>
                <Alert color={wizardExecuted ? 'teal' : 'yellow'} variant="light" icon={<IconShieldCheck size={16} />}>
                  {wizardExecuted
                    ? '已触发自动修复。现在建议先重新巡检，再决定是否恢复受限技能。'
                    : '当前尚未执行自动修复。'}
                </Alert>
                <List
                  size="sm"
                  spacing="xs"
                  icon={
                    <ThemeIcon size={18} radius="xl" color="teal" variant="light">
                      <IconCheck size={12} />
                    </ThemeIcon>
                  }
                >
                  <List.Item>先点“重新巡检”，确认风险是否已经下降。</List.Item>
                  <List.Item>再到“受限技能”里逐个恢复真正需要的技能。</List.Item>
                  <List.Item>如果仍有业务必须放行，再去添加临时豁免。</List.Item>
                </List>
                <Group justify="space-between">
                  <Button variant="default" onClick={closeWizard}>
                    完成
                  </Button>
                  <Group gap="sm">
                    <Button variant="light" onClick={onRunAudit}>
                      立即重新巡检
                    </Button>
                    <Button variant="light" onClick={onRestoreAllRestricted}>
                      查看并恢复受限技能
                    </Button>
                  </Group>
                </Group>
              </Stack>
            </Card>
          ) : null}
        </Stack>
      </Modal>
    </>
  )
}
