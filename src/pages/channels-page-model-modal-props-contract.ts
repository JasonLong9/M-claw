import type { ComponentProps } from 'react'

import type ChannelsPageModelConfigModal from '../components/ChannelsPageModelConfigModal'
import type { ChannelsPageChannelInfo } from './channels-page-data-contract'
import type { ChannelsPageModelModalState } from './channels-page-model-config-contract'

export interface ChannelsPageModelModalPropsOptions
  extends ChannelsPageModelModalState<ChannelsPageChannelInfo> {}

export interface ChannelsPageModelModalPropsResult {
  modelConfigModalProps: ComponentProps<typeof ChannelsPageModelConfigModal>
}
