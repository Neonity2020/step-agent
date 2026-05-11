// ============================================================
// Session Types - 会话类型定义
// ============================================================

// 消息角色
export type MessageRole = "user" | "assistant" | "tool" | "system"

// 会话条目类型
export type EntryType = "user" | "assistant" | "tool" | "meta"

// 会话条目（JSONL 中的一行）
export interface SessionEntry {
  id: string              // 唯一 ID
  parentId: string | null // 父节点 ID（null 表示根）
  type: EntryType         // 条目类型
  role: MessageRole       // 角色
  content: string         // 内容
  timestamp: string       // ISO 时间戳
  toolName?: string       // 工具名（tool 类型时）
  toolCallId?: string     // 工具调用 ID（tool 类型时关联 assistant tool call）
  toolCalls?: Array<{ id?: string; name: string; input: Record<string, unknown> }>
  toolInput?: Record<string, unknown>  // 工具输入
  toolResult?: string     // 工具结果
  thinking?: string       // 模型思考内容（如果 provider 返回）
  label?: string          // 标签/书签
}

// 会话元数据（JSONL 第一行）
export interface SessionMeta {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  currentEntryId: string  // 当前活动条目 ID
  version: 1              // 格式版本
}

// 会话（内存中）
export interface Session {
  meta: SessionMeta
  path: string           // 文件路径
  entries: SessionEntry[] // 内存缓存
}

// 会话列表项（用于列表展示）
export interface SessionInfo {
  id: string
  name: string
  path: string
  createdAt: string
  updatedAt: string
  entryCount: number
}

// 会话树节点
export interface SessionTreeNode {
  entry: SessionEntry
  children: SessionTreeNode[]
  depth: number
  isActive: boolean
}

// 会话指针（当前分支位置）
export interface SessionPointer {
  entryId: string
  path: SessionEntry[]  // 从根到当前节点的路径
}
