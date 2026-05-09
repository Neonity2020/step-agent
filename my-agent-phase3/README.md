# My Agent - Phase 3

> 会话管理：持久化存储 + 会话树 + 分支

## 项目结构

```
my-agent-phase3/
├── src/
│   ├── cli/
│   │   ├── cli.ts           # 基础 CLI (复用 Phase 1)
│   │   └── session-cli.ts  # 会话管理 CLI (Phase 3 新增)
│   ├── tui/
│   │   ├── tui.ts          # TUI 主组件 (更新)
│   │   └── ...
│   ├── session/            # 会话管理 (Phase 3 新增/重写)
│   │   ├── types.ts       # 会话类型定义
│   │   ├── manager.ts      # 会话管理器
│   │   └── session.ts      # 导出
│   ├── providers/          # (复用 Phase 1)
│   ├── tools/              # (复用 Phase 1)
│   ├── agent/              # Agent 核心 (更新)
│   └── types/              # (复用 Phase 1)
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd my-agent-phase3
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. 运行

**会话管理 TUI (推荐)：**
```bash
bun run ./src/cli/session-cli.ts
```

**简单 CLI：**
```bash
bun run ./src/cli/cli.ts
```

## Phase 3 交付物

- [x] JSONL 持久化存储
- [x] 会话树结构
- [x] 分支创建
- [x] 时间旅行（跳转到任意点）
- [x] 会话列表
- [x] 会话导出

## 会话存储

会话存储在 `~/.myagent/sessions/` 目录，格式为 JSONL：

```jsonl
{"id":"sess-xxx","name":"my-session","createdAt":"...","currentEntryId":"...","version":1}
{"id":"entry-1","parentId":null,"type":"meta","role":"system","content":"...","timestamp":"..."}
{"id":"entry-2","parentId":"entry-1","type":"user","role":"user","content":"Hello","timestamp":"..."}
{"id":"entry-3","parentId":"entry-2","type":"assistant","role":"assistant","content":"Hi!","timestamp":"..."}
```

## 命令

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助 |
| `/sessions` | 列出会话 |
| `/new` | 创建新会话 |
| `/switch <id>` | 切换到指定会话 |
| `/branch [name]` | 从当前点创建分支 |
| `/tree` | 显示会话树 |
| `/export [file]` | 导出会话为 JSON |
| `/quit` | 退出 |

## 会话树结构

```
root (meta)
├── user: "Hello"
│   └── assistant: "Hi!"
│       └── tool: "bash ls"
│           └── assistant: "Files: ..."
└── user: "List files"
    └── assistant: "Here are..."
```

## TUI 功能

| 功能 | 说明 |
|------|------|
| 会话持久化 | 自动保存到 JSONL |
| 会话树 | 可视化分支结构 |
| 分支创建 | 从任意点创建新分支 |
| 时间旅行 | 跳转到任意历史点 |
| 会话导出 | 导出为 JSON |

## 下一阶段

[Phase 4: 扩展系统 (Plugin)](../AGENT_ROADMAP.md#phase-4-扩展系统-plugin)

## 工作流程示例

```bash
# 1. 启动会话
bun run ./src/cli/session-cli.ts

# 2. 在 TUI 中
/ls                    # 列出会话
/branch experiment     # 创建实验分支
/tree                  # 查看会话树
/export experiment.json # 导出会话
```
