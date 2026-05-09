# My Agent - Knowledge Base

> 外部知识库：持久化上下文，跨会话共享

## 项目结构

```
my-agent-kb/
├── src/
│   ├── cli/
│   │   ├── kb-cli.ts       # 知识库模式 (新增)
│   │   └── ...
│   ├── kb/               # 知识库模块 (新增)
│   │   ├── types.ts     # 类型定义
│   │   ├── storage.ts   # 存储层
│   │   ├── manager.ts   # 管理器
│   │   └── index.ts     # 导出
│   └── ...
└── README.md
```

## 快速开始

```bash
cd my-agent-kb
bun install
export ANTHROPIC_API_KEY=sk-ant-your-key-here

# 启动
bun run ./src/cli/kb-cli.ts
```

## 知识库功能

### 持久化上下文

```
Session 1                    Session 2
    │                           │
    ├── Save project info ──────┼──→ Load project context
    ├── Save decision ──────────┼──→ Recall decisions
    └── Save pattern ───────────┼──→ Use pattern
```

### 自动上下文加载

新会话启动时自动加载：
- 项目信息（结构、依赖、配置）
- 重要决策
- 最近的会话摘要
- 相关代码模式

### 知识类型

| 类型 | 说明 | 示例 |
|------|------|------|
| `project` | 项目信息 | 结构、配置、依赖 |
| `decision` | 架构决策 | 选择理由、技术选型 |
| `pattern` | 代码模式 | 模板、惯用法 |
| `task` | 任务摘要 | 完成的工作 |
| `context` | 会话摘要 | 关键点、待办 |
| `rule` | 规则约定 | 编码规范 |
| `note` | 笔记 | 一般性记录 |

## 知识库命令

| 命令 | 说明 |
|------|------|
| `/kb` | 显示知识库状态 |
| `/kb:add <type> <title>` | 添加条目 |
| `/kb:search <query>` | 搜索知识库 |
| `/kb:save [topic]` | 保存当前会话 |
| `/kb:export` | 导出知识库 |
| `/kb:prune` | 清理低优先级条目 |

## API 示例

```typescript
import { KnowledgeBase } from "./kb"

// 创建知识库
const kb = new KnowledgeBase()

// 保存项目信息
kb.saveProjectInfo({
  name: "my-project",
  structure: "src/, tests/, docs/",
  dependencies: ["react", "express"],
  scripts: { dev: "npm run dev" }
})

// 保存决策
kb.saveDecision({
  title: "Use TypeScript",
  rationale: "Better type safety",
  alternatives: ["JavaScript", "Flow"]
})

// 保存代码模式
kb.savePattern({
  name: "React Hook",
  language: "typescript",
  code: "const useExample = () => { ... }"
})

// 保存会话摘要
kb.saveSessionSummary({
  sessionId: "sess-123",
  topic: "Setup authentication",
  keyPoints: [
    "Added JWT middleware",
    "Created auth routes"
  ],
  completed: true
})

// 搜索
const results = kb.search("authentication")

// 获取新会话上下文
const context = kb.getContextForNewSession("add login page")
// → 自动加载相关项目信息、决策、模式
```

## 工作流程

```
1. 开始新会话
   ↓
2. 知识库自动加载相关上下文
   ├── 项目信息
   ├── 重要决策
   ├── 最近会话摘要
   └── 相关模式
   ↓
3. Agent 利用上下文工作
   ↓
4. 重要内容保存到知识库
   ├── 完成的决策
   ├── 新模式
   └── 会话摘要
   ↓
5. 保存会话
   /kb:save "feature-x"
   ↓
6. 下个会话继续...
```

## 存储位置

```
~/.myagent/knowledge/
├── kb-xxx-1.json   # 项目信息
├── kb-xxx-2.json   # 决策
├── kb-xxx-3.json   # 模式
└── ...
```

## 重要性等级

| 等级 | 值 | 说明 |
|------|-----|------|
| CRITICAL | 90 | 必须保留 |
| HIGH | 70 | 重要 |
| MEDIUM | 50 | 一般 |
| LOW | 30 | 可丢弃 |
| TEMPORARY | 10 | 临时 |

## 启动界面

```
┌────────────────────────────────────────────────────────────┐
│  My Agent - Knowledge Base Mode                              │
├────────────────────────────────────────────────────────────┤
│  📖 External Knowledge Base                                  │
│  💾 Persistent context across sessions                      │
│  🧠 Smart context loading                                   │
├────────────────────────────────────────────────────────────┤
│  Knowledge: 25 entries                                       │
│  Skills: 4 loaded                                           │
├────────────────────────────────────────────────────────────┤
│  Type /help for commands                                    │
└────────────────────────────────────────────────────────────┘

📖 Knowledge Base: 25 entries
   Project: 1 | Decisions: 5 | Patterns: 8 | Tasks: 11
```

## 与 Context 压缩的区别

| 特性 | Context 压缩 | 知识库 |
|------|-------------|--------|
| 持久化 | ❌ 内存 | ✅ 文件 |
| 选择性 | 自动 | 手动 |
| 跨会话 | ❌ | ✅ |
| 容量 | 受限 | 无限 |
| 检索 | 无 | 搜索 |

## 下一步

- 添加自动知识提取（LLM 分析会话）
- 知识库可视化界面
- 知识库同步/分享
- 自动过期清理
