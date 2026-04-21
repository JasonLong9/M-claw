import type {
  OfficialChannelStatusStage,
  OfficialChannelStatusStageState,
} from './official-channel-integration'

export function getOfficialChannelStageLabel(
  stageId: OfficialChannelStatusStage['id']
): string {
  if (stageId === 'installed') return '已安装'
  if (stageId === 'registered') return '已注册'
  if (stageId === 'loaded') return '已加载'
  return '就绪'
}

export function getOfficialChannelStageStateLabel(
  state: OfficialChannelStatusStageState
): string {
  if (state === 'verified') return '已验证'
  if (state === 'missing') return '缺失'
  return '未知 / 未验证'
}

export function getOfficialChannelStageColor(
  state: OfficialChannelStatusStageState
): string {
  if (state === 'verified') return 'teal'
  if (state === 'missing') return 'red'
  return 'gray'
}
