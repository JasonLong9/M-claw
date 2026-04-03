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
    <div className="w-full max-w-md flex flex-col items-center gap-2">
      {/* Header: Logo + Title + Safety Badge */}
      <div className="flex items-center gap-2.5">
        <BrandWordmark size="hero" />
        <div className="flex items-center gap-1 ml-1 px-2 py-0.5 rounded-full bg-yellow-500/10">
          <IconAlertTriangle size={13} className="text-yellow-500" />
          <Text fw={600} size="xs" className="text-yellow-500">安全提醒</Text>
        </div>
      </div>

      {/* Card 1: About OpenClaw */}
      <div className="w-full rounded-lg app-bg-secondary px-3.5 py-2.5 flex flex-col">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-400 flex-shrink-0" />
          <Text fw={600} size="sm" className="app-text-primary">关于 OpenClaw</Text>
        </div>
        <Text size="xs" className="app-text-secondary mt-0.5">
          OpenClaw 是一个 AI 助手，为了完成任务，它需要以下权限：
        </Text>
        <ul className="list-disc list-inside app-text-secondary mt-0.5 flex flex-col" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
          <li>读取和修改文件、执行系统命令、连接互联网</li>
          <li>访问您的 API 密钥（用于调用 AI 服务）</li>
          <li>操作 IM 应用（飞书、企微、钉钉等）</li>
          <li><span className="app-text-warning font-medium">使用 AI 服务会产生费用，取决于您选择的提供商</span></li>
        </ul>
      </div>

      {/* Card 2: About Mclaw */}
      <div className="w-full rounded-lg app-bg-secondary px-3.5 py-2.5 flex flex-col">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-400 flex-shrink-0" />
          <Text fw={600} size="sm" className="app-text-primary">关于 Mclaw</Text>
        </div>
        <Text size="xs" className="app-text-secondary mt-0.5">
          Mclaw 是轻量化的 OpenClaw 管家，Mclaw 会：
        </Text>
        <ul className="list-disc list-inside app-text-secondary mt-0.5 flex flex-col" style={{ fontSize: '12.5px', lineHeight: 1.7 }}>
          <li>自动配置内置组件（无网释放独立的 OpenClaw 本体及 IM 插件）</li>
          <li>智能扫描并补齐系统 Node.js 运行环境</li>
          <li><span className="app-text-warning font-medium">保护现有配置（部署前自动备份，绝不静默覆盖业务数据）</span></li>
        </ul>
      </div>

      <div className="w-full border border-red-500/20 rounded-lg app-bg-secondary px-3.5 py-2.5 flex flex-col bg-red-400/5">
        <div className="flex items-center gap-1.5">
          <IconPinFilled size={12} className="text-red-500 flex-shrink-0" />
          <Text fw={600} size="sm" className="text-red-400 font-bold">高危风险须知</Text>
        </div>
        <div className="mt-1">
          <ul className="list-disc list-inside flex flex-col gap-1.5 app-text-secondary" style={{ fontSize: '12.5px', lineHeight: 1.6 }}>
            <li><span className="text-red-400/90 font-medium">系统提权与文件级访问：</span>系统拥有完整的任意代码执行能力，强烈建议**不要用于包含敏感数据的裸机系统**。</li>  
            <li><span className="text-red-400/90 font-medium">全局 Node.js 强制覆盖风险：</span>内置运行依赖 Node.js v22.16+。如果探测到不符合要求，<span className="font-bold underline decoration-red-500/50 underline-offset-2">Mclaw 将调用原生静默安装包强制跨版本升级全局 Node.js</span>，这可能会导致您的旧版 npm/node 项目出现不可测损坏，请谨慎。</li>  
          </ul>
        </div>
      </div>

      {/* Checkbox */}
      <Checkbox
        label="我已阅读并了解以上内容"
        checked={accepted}
        onChange={(e) => setAccepted(e.currentTarget.checked)}
        className="self-start"
        size="sm"
      />

      {/* Confirm Button */}
      <Button fullWidth disabled={!accepted} onClick={onAccept} size="sm">
        确认继续
      </Button>
    </div>
  )
}
