import type { ComponentProps } from 'react'

import { Loader } from '@mantine/core'

import ChannelsPageChannelCards from './ChannelsPageChannelCards'
import ChannelsPageChannelListPanel from './ChannelsPageChannelListPanel'
import ChannelsPageConfigModal from './ChannelsPageConfigModal'
import ChannelsPageDiagnosticsModal from './ChannelsPageDiagnosticsModal'
import ChannelsPageModelConfigModal from './ChannelsPageModelConfigModal'
import ChannelsPagePairingModal from './ChannelsPagePairingModal'
import ChannelsPageTopPanel from './ChannelsPageTopPanel'

interface ChannelsPageShellProps {
  loading: boolean
  topPanelProps: ComponentProps<typeof ChannelsPageTopPanel>
  channelListPanelProps: ComponentProps<typeof ChannelsPageChannelListPanel>
  channelCardsProps: ComponentProps<typeof ChannelsPageChannelCards>
  configModalProps: ComponentProps<typeof ChannelsPageConfigModal>
  pairingModalProps: ComponentProps<typeof ChannelsPagePairingModal>
  modelConfigModalProps: ComponentProps<typeof ChannelsPageModelConfigModal>
  diagnosticsModalProps: ComponentProps<typeof ChannelsPageDiagnosticsModal>
}

export default function ChannelsPageShell({
  loading,
  topPanelProps,
  channelListPanelProps,
  channelCardsProps,
  configModalProps,
  pairingModalProps,
  modelConfigModalProps,
  diagnosticsModalProps,
}: ChannelsPageShellProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader size="lg" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <ChannelsPageTopPanel {...topPanelProps} />

      <ChannelsPageChannelListPanel {...channelListPanelProps}>
        <ChannelsPageChannelCards {...channelCardsProps} />
      </ChannelsPageChannelListPanel>

      {/* 闂傚倸鍊搁崐鎼佸磹閹间礁纾归柟闂寸绾惧綊鏌熼梻瀵割槮缁炬儳缍婇弻锝夊箣閿濆憛鎾绘煕婵犲倹鍋ラ柡灞诲姂瀵潙螖閳ь剚绂嶉幆褜娓婚柕鍫濋楠炴牠鏌ｈ箛鏃傜畾闁诲繑甯″娲礂閼测斂鍋為梺鍝勬噺缁诲牓骞冮敍鍕ㄥ亾閿濆骸鏋熼柍閿嬪灴閺屾盯骞橀弶鎴犵シ婵炲瓨绮嶇换鍐崲濞戙垹鐭楀鑸电閳ь剝娉曢埀顒冾潐濞叉﹢宕归崸妞尖偓渚€寮崼婵嬪敹闂佺粯鏌ㄩ幖顐︾嵁閸儲鈷掑ù锝堫潐閻忛亶鏌￠崨顔炬创鐎规洦鍨舵俊鎼佹晜缂併垺绁梻浣虹帛椤洨鍒掗鐐村亗闁告劦浜濋崰鎰節婵犲倻澧曠紒鈧崼鐔稿弿婵☆垰娼￠崫娲煛閸℃鐭掗柡灞诲姂閹垽宕崟鎴欏灮缁辨帡鎮╁畷鍥р拰闂佸搫鑻粔鐟扮暦椤愶箑绀嬫い鎰剁稻椤斿鈹戦悩鎰佸晱闁稿劋鍗虫俊鍫曞箹娴ｆ瓕鎽曞┑鐐村灟閸ㄥ湱绮诲☉娆嶄簻闁瑰搫绉烽澶愭煛鐎ｎ偆鎳冮柍?Modal */}
      <ChannelsPageConfigModal {...configModalProps} />

      <ChannelsPagePairingModal {...pairingModalProps} />

      <ChannelsPageModelConfigModal {...modelConfigModalProps} />

      <ChannelsPageDiagnosticsModal {...diagnosticsModalProps} />
    </div>
  )
}
