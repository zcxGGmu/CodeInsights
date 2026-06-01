import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

mock.module('electron', () => ({
  BrowserWindow: {
    getFocusedWindow: () => null,
  },
  dialog: {
    showOpenDialog: async () => ({ canceled: true, filePaths: [] }),
  },
}))

const originalConfigDir = process.env.CODEINSIGHTS_CONFIG_DIR
let tempConfigDir = ''

beforeEach(() => {
  tempConfigDir = mkdtempSync(join(tmpdir(), 'codeinsights-conversation-search-'))
  process.env.CODEINSIGHTS_CONFIG_DIR = tempConfigDir
})

afterEach(() => {
  if (originalConfigDir === undefined) {
    delete process.env.CODEINSIGHTS_CONFIG_DIR
  } else {
    process.env.CODEINSIGHTS_CONFIG_DIR = originalConfigDir
  }
  if (tempConfigDir) {
    rmSync(tempConfigDir, { recursive: true, force: true })
    tempConfigDir = ''
  }
})

async function loadConversationManager(): Promise<typeof import('./conversation-manager')> {
  return import('./conversation-manager')
}

describe('conversation-manager search', () => {
  test('搜索保持每个对话第一条命中和最多 30 条的旧行为', async () => {
    const {
      appendMessage,
      createConversation,
      searchConversationMessages,
    } = await loadConversationManager()

    for (let index = 0; index < 35; index += 1) {
      const conversation = createConversation(`搜索会话 ${index}`)
      appendMessage(conversation.id, {
        id: `skip-${index}`,
        role: 'user',
        content: '没有命中',
        createdAt: 1,
      })
      appendMessage(conversation.id, {
        id: `hit-first-${index}`,
        role: 'assistant',
        content: `第一条包含关键字 ${index}`,
        createdAt: 2,
      })
      appendMessage(conversation.id, {
        id: `hit-second-${index}`,
        role: 'assistant',
        content: `第二条也包含关键字 ${index}`,
        createdAt: 3,
      })
    }

    const results = await searchConversationMessages('关键字')

    expect(results).toHaveLength(30)
    expect(results[0]).toMatchObject({
      conversationTitle: '搜索会话 0',
      messageId: 'hit-first-0',
      role: 'assistant',
    })
    expect(results.some((result) => result.messageId.startsWith('hit-second'))).toBe(false)
  })

  test('搜索跳过坏 JSONL 行并保留高亮坐标', async () => {
    const {
      createConversation,
      searchConversationMessages,
    } = await loadConversationManager()
    const conversation = createConversation('坏行搜索')
    writeFileSync(
      join(tempConfigDir, 'conversations', `${conversation.id}.jsonl`),
      [
        '{bad json',
        JSON.stringify({
          id: 'message-hit',
          role: 'user',
          content: '这里包含关键字',
          createdAt: 1,
        }),
      ].join('\n'),
      'utf-8',
    )

    const results = await searchConversationMessages('关键字')

    expect(results).toHaveLength(1)
    expect(results[0]?.messageId).toBe('message-hit')
    expect(results[0]?.matchStart).toBe(results[0]?.snippet.indexOf('关键字'))
    expect(results[0]?.matchLength).toBe(3)
  })

  test('query 长度小于 2 时不触发内容搜索', async () => {
    const { searchConversationMessages } = await loadConversationManager()

    await expect(searchConversationMessages('关')).resolves.toEqual([])
    await expect(searchConversationMessages('')).resolves.toEqual([])
  })
})
