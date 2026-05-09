# My Agent - Phase 2

> 交互式终端 (TUI)：漂亮的终端界面

## 项目结构

```
my-agent-phase2/
├── src/
│   ├── cli/
│   │   ├── cli.ts          # 基础 CLI (from Phase 1)
│   │   └── tui-cli.ts      # TUI 入口 (Phase 2 新增)
│   ├── tui/                # TUI 模块 (Phase 2 新增)
│   │   ├── colors.ts       # ANSI 颜色和样式
│   │   ├── messages.ts     # 消息渲染
│   │   ├── screen.ts       # 核心屏幕渲染
│   │   ├── input.ts        # 交互式输入处理
│   │   └── tui.ts          # TUI 主组件
│   ├── providers/          # (from Phase 1)
│   ├── tools/              # (from Phase 1)
│   ├── agent/              # (from Phase 1)
│   ├── session/            # (from Phase 1)
│   └── types/              # (from Phase 1)
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd my-agent-phase2
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. 运行

**交互模式 (推荐)：**
```bash
bun run ./src/cli/tui-cli.ts
```

**简单模式 (无 TUI)：**
```bash
bun run ./src/cli/cli.ts
```

## Phase 2 交付物

- [x] ANSI 颜色系统
- [x] 消息渲染模块
- [x] 核心 TUI 屏幕渲染
- [x] 交互式输入处理
- [x] TUI 主组件
- [x] 状态栏 (Session, Model, Tokens)
- [x] 思考状态显示

## TUI 界面预览

```
┌────────────────────────────────────────────────────────────┐
│  My Agent • Phase 2: Interactive TUI                      │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  👤 You                                                    │
│  ────────────────────────────────────────                  │
│  List files in current directory                           │
│                                                            │
│  🤖 Assistant                                              │
│  ────────────────────────────────────────                  │
│  I'll help you list the files.                            │
│                                                            │
│  🔧 Tool: bash                                             │
│  ────────────────────────────────────────                  │
│  file1.txt                                                │
│  file2.txt                                                │
│  src/                                                     │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ ❯ List files here                                         │
│   Ctrl+C: Quit  •  Enter: Send  •  Ctrl+U: Clear           │
├────────────────────────────────────────────────────────────┤
│  Session: sess-xxx  Model: claude-sonnet-4  Tokens: 1234   │
└────────────────────────────────────────────────────────────┘
```

## TUI 功能

| 功能 | 说明 |
|------|------|
| 消息历史 | 显示完整的对话历史 |
| 角色标识 | 👤 User / 🤖 Assistant / 🔧 Tool |
| 思考状态 | 💭 显示 Agent 思考中 |
| 状态栏 | Session, Model, Token 计数 |
| 彩色输出 | 不同角色不同颜色 |

## 下一阶段

[Phase 3: 会话管理系统 (持久化 + 分支)](../AGENT_ROADMAP.md#phase-3-会话管理系统)

## 内置快捷键

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+C` | 退出 |
| `Ctrl+U` | 清空输入 |
| `Ctrl+L` | 清屏 |
