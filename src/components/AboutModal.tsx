import { useEffect, useState } from 'react'
import { Divider, Group, Modal, Stack, Text, Tooltip } from '@mantine/core'
import packageJson from '../../package.json'
import bilibiliSvg from '../assets/brand-bilibili.svg'
import douyinSvg from '../assets/brand-tiktok.svg'
import xiaohongshuSvg from '../assets/brand-xiaohongshu.svg'
import youtubeSvg from '../assets/brand-youtube.svg'
import BrandWordmark from './BrandWordmark'

const ABOUT_MCLAW_URL = 'https://my.feishu.cn/wiki/N4PGwaSTOiSuavknd5ncRsyqnth'
const APP_VERSION = packageJson.version
const SOCIAL_CARD_PLACEHOLDER =
  '\u5b98\u65b9\u6e20\u9053\u5efa\u8bbe\u4e2d\uff0c\u540e\u7eed\u4f1a\u63a5\u5165 MetaCode \u5de5\u4f5c\u5ba4\u7684\u6b63\u5f0f\u94fe\u63a5\u3002'

export function resolveAboutModalVersion(
  status: {
    currentVersion?: string | null
  } | null | undefined
): string {
  return String(status?.currentVersion || '').trim()
}

export function resolveAboutModalSocialPlaceholder(label: string): string {
  return `${label}\uff1a${SOCIAL_CARD_PLACEHOLDER}`
}

const SOCIAL_LINKS = [
  { label: 'Bilibili', icon: bilibiliSvg },
  { label: '\u6296\u97f3', icon: douyinSvg },
  { label: '\u5c0f\u7ea2\u4e66', icon: xiaohongshuSvg },
  { label: 'YouTube', icon: youtubeSvg },
]

function SocialCard({ label, icon }: { label: string; icon: string }) {
  const [hovered, setHovered] = useState(false)

  return (
    <Tooltip label={resolveAboutModalSocialPlaceholder(label)} withArrow multiline maw={220}>
      <div
        role="button"
        aria-disabled="true"
        onClick={(event) => event.preventDefault()}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          cursor: 'not-allowed',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: '10px 12px',
          borderRadius: 10,
          border: `1px solid ${hovered ? 'var(--app-hover-border)' : 'var(--app-border)'}`,
          background: hovered
            ? 'linear-gradient(180deg, var(--app-bg-tertiary) 0%, rgba(255,255,255,0) 100%)'
            : 'linear-gradient(180deg, var(--app-bg-secondary) 0%, rgba(255,255,255,0) 100%)',
          transition: 'border-color 0.15s ease, background 0.15s ease, transform 0.15s ease',
          minWidth: 62,
          opacity: 0.7,
          userSelect: 'none',
        }}
      >
        <img src={icon} alt={label} style={{ width: 20, height: 20, objectFit: 'contain' }} />
        <Text size="xs" c="var(--app-text-muted)" style={{ fontSize: 10, lineHeight: 1 }}>
          {label}
        </Text>
      </div>
    </Tooltip>
  )
}

export default function AboutModal({ opened, onClose }: { opened: boolean; onClose: () => void }) {
  const [appVersion, setAppVersion] = useState(APP_VERSION)

  useEffect(() => {
    if (!opened) return

    let cancelled = false
    void window.api.getQClawUpdateStatus()
      .then((status) => {
        const nextVersion = resolveAboutModalVersion(status)
        if (!cancelled && nextVersion) {
          setAppVersion(nextVersion)
        }
      })
      .catch(() => null)

    return () => {
      cancelled = true
    }
  }, [opened])

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title={(
        <a
          href={ABOUT_MCLAW_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'inherit', textDecoration: 'none' }}
          className="hover:underline"
        >
          {'\u5173\u4e8e Mclaw'}
        </a>
      )}
      centered
      size="sm"
    >
      <Stack gap="md" py="xs">
        <div className="flex justify-center">
          <BrandWordmark size="body" />
        </div>

        <div
          style={{
            padding: '12px 14px',
            borderRadius: 10,
            background:
              'linear-gradient(180deg, var(--app-bg-tertiary) 0%, rgba(255,255,255,0.01) 100%)',
            border: '1px solid var(--app-border)',
          }}
        >
          <Text size="sm" fw={600} ta="center">
            {'MetaCode \u5de5\u4f5c\u5ba4\u5185\u90e8\u6d4b\u8bd5\u7248'}
          </Text>
          <Text size="xs" c="var(--app-text-secondary)" ta="center" mt={6} style={{ lineHeight: 1.7 }}>
            {'\u5f53\u524d\u7248\u672c\u805a\u7126\u672c\u5730\u804a\u5929\u3001\u5f00\u53d1\u6a21\u5f0f\u4e0e\u6a21\u578b\u63a5\u5165\u94fe\u8def\u9a8c\u8bc1\u3002'}
            <br />
            {'\u516c\u4f17\u53f7\u4e8c\u7ef4\u7801\u4e0e\u5916\u90e8\u5e73\u53f0\u94fe\u63a5\u6682\u672a\u5f00\u653e\uff0c\u540e\u7eed\u4f1a\u7edf\u4e00\u66ff\u6362\u4e3a MetaCode \u5de5\u4f5c\u5ba4\u5b98\u65b9\u6e20\u9053\u3002'}
          </Text>
        </div>

        <Divider />

        <Stack gap={4} align="center">
          <Text size="sm" c="var(--app-text-muted)">
            {'\u7248\u672c'} {appVersion || '--'}
          </Text>
          <Text size="sm" c="var(--app-text-muted)">
            {'MetaCode \u5de5\u4f5c\u5ba4\u7ef4\u62a4'}
          </Text>
          <Text size="sm" c="var(--app-text-muted)">内置 Mclaw 本机运行组件</Text>
          <Text size="xs" c="var(--app-text-muted)" ta="center">
            {'\u57fa\u4e8e Apache License 2.0 \u5206\u53d1\uff0c\u8be6\u60c5\u8bf7\u67e5\u770b `LICENSE`\u3002'}
          </Text>
        </Stack>

        <Group justify="center" gap="sm">
          {SOCIAL_LINKS.map((link) => (
            <SocialCard key={link.label} {...link} />
          ))}
        </Group>
      </Stack>
    </Modal>
  )
}
