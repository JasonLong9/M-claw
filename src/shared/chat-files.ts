export const CHAT_FILE_MAX_BYTES = 32 * 1024
export const CHAT_FILE_EXTENSIONS = ['.txt', '.md', '.csv', '.json']

export interface ChatFileAttachment {
  name: string
  text: string
}

export function validateChatFile(value: unknown): ChatFileAttachment {
  if (!value || typeof value !== 'object') throw new Error('文件格式无效')
  const { name, text } = value as Partial<ChatFileAttachment>
  if (typeof name !== 'string' || name.length > 180 || /[\\/\x00-\x1f]/.test(name) ||
    !CHAT_FILE_EXTENSIONS.some((extension) => name.toLowerCase().endsWith(extension))) {
    throw new Error('请选择 TXT、Markdown、CSV 或 JSON 文件')
  }
  if (typeof text !== 'string' || !text.trim() || text.includes('\0') ||
    new TextEncoder().encode(text).byteLength > CHAT_FILE_MAX_BYTES) {
    throw new Error('文件须为不超过 32 KB 的非空 UTF-8 文本')
  }
  return { name, text }
}
