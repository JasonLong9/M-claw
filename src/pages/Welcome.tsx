import { useState } from 'react'
import { Button, Checkbox, Text } from '@mantine/core'
import { IconAlertTriangle, IconPinFilled } from '@tabler/icons-react'
import BrandWordmark from '@/components/BrandWordmark'

interface WelcomeProps {
  onAccept: () => void
}

export default function Welcome({ onAccept }: WelcomeProps) {
  const [accepted, setAccepted] = useState(false)

  return (
    <div className="w-full max-w-md max-h-[calc(100vh-112px)] flex flex-col items-center gap-2 overflow-hidden">
      <div className="flex items-center gap-2.5">
        <BrandWordmark size="hero" />
        <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-yellow-500/10">
          <IconAlertTriangle size={13} className="text-yellow-500" />
          <Text fw={600} size="xs" className="text-yellow-500">安全提醒</Text>
        </div>
      </div>

      <div className="w-full rounded-lg app-bg-secondary px-3 py-2 flex flex-col">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-400 flex-shrink-0" />
          <Text fw={600} size="sm" className="app-text-primary">关于 Mclaw</Text>
        </div>
        <Text size="xs" className="app-text-secondary mt-0.5">
          为完成自动化任务，Mclaw 需要系统与网络权限：
        </Text>
        <ul className="list-disc list-inside app-text-secondary mt-0.5 flex flex-col" style={{ fontSize: '12px', lineHeight: 1.45 }}>
          <li>读取/修改文件、执行命令、联网</li>
          <li>访问 API Key，操作 IM 应用（飞书/企微/钉钉）</li>
          <li><span className="app-text-warning font-medium">AI 服务可能产生费用</span></li>
        </ul>
      </div>

      <div className="w-full rounded-lg app-bg-secondary px-3 py-2 flex flex-col">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-400 flex-shrink-0" />
          <Text fw={600} size="sm" className="app-text-primary">运行说明</Text>
        </div>
        <ul className="list-disc list-inside app-text-secondary mt-0.5 flex flex-col" style={{ fontSize: '12px', lineHeight: 1.45 }}>
          <li>会自动配置网关与 IM 相关运行组件</li>
          <li>会自动检查并补齐 Node.js 运行环境</li>
          <li><span className="app-text-warning font-medium">部署前会自动备份现有配置</span></li>
        </ul>
      </div>

      <div className="w-full border border-red-500/20 rounded-lg app-bg-secondary px-3 py-2 flex flex-col bg-red-400/5">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-500 flex-shrink-0" />
          <Text fw={600} size="sm" className="text-red-400 font-bold">高风险提示</Text>
        </div>
        <ul className="list-disc list-inside mt-1 flex flex-col gap-1 app-text-secondary" style={{ fontSize: '12px', lineHeight: 1.45 }}>
          <li><span className="text-red-400/90 font-medium">系统提权风险：</span>具备完整命令执行能力，请勿用于敏感环境。</li>
          <li><span className="text-red-400/90 font-medium">Node.js 升级风险：</span>可能影响旧版 npm/node 项目。</li>
        </ul>
      </div>

      <Checkbox
        label="我已阅读并理解以上内容"
        checked={accepted}
        onChange={(e) => setAccepted(e.currentTarget.checked)}
        className="self-start"
        size="xs"
      />

      <Button fullWidth disabled={!accepted} onClick={onAccept} size="sm">
        确认继续
      </Button>
    </div>
  )
}
