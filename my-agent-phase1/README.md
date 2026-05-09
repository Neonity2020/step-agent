# My Agent - Phase 1

> 核心骨架：最基本的多轮对话 Agent

## 项目结构

```
my-agent-phase1/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── types/
│   │   └── index.ts        # 共享类型定义
│   ├── providers/
│   │   ├── base.ts         # Provider 接口
│   │   ├── anthropic.ts    # Anthropic 实现
│   │   └── openai.ts       # OpenAI 实现
│   ├── tools/
│   │   ├── base.ts         # Tool 接口
│   │   ├── read.ts         # 读文件
│   │   ├── write.ts        # 写文件
│   │   ├── edit.ts         # 编辑文件
│   │   └── bash.ts         # 执行命令
│   ├── agent/
│   │   └── agent.ts        # Agent 核心逻辑
│   └── session/
│       └── session.ts      # 会话管理
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd my-agent-phase1
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. 运行

**单次命令模式：**
```bash
bun run ./src/cli/cli.ts "List files in current directory"
```

**交互模式：**
```bash
bun run ./src/cli/cli.ts
```

## Phase 1 交付物

- [x] CLI 入口（支持单次命令和交互模式）
- [x] Provider 接口 + Anthropic 实现
- [x] Tool 接口 + 4 个内置工具（read, write, edit, bash）
- [x] Agent 核心循环（User ↔ Agent ↔ Tools）
- [x] 简单会话管理（内存版）

## 下一阶段

[Phase 2: 交互式终端 (TUI)](../AGENT_ROADMAP.md#phase-2-交互式终端-tui)

## 内置工具

| 工具 | 说明 |
|------|------|
| `read` | 读取文件内容，支持行号范围 |
| `write` | 创建或覆盖文件 |
| `edit` | 精确文本替换 |
| `bash` | 执行 shell 命令 |
