# My Agent - Skills Support

> Agent Skills 功能：兼容 Claude Code 的 SKILL.md 格式

## 项目结构

```
my-agent-skills/
├── src/
│   ├── cli/
│   │   ├── skills-cli.ts     # Skills 模式 (新增)
│   │   ├── mcp-cli.ts        # MCP 模式
│   │   └── ...
│   ├── skills/              # Skills 模块 (新增)
│   │   ├── types.ts         # 类型定义
│   │   ├── parser.ts        # SKILL.md 解析器
│   │   ├── matcher.ts       # 技能匹配器
│   │   ├── loader.ts       # 技能加载器
│   │   ├── manager.ts      # 技能管理器
│   │   └── examples/       # 示例技能
│   │       ├── review-code.SKILL.md
│   │       ├── write-tests.SKILL.md
│   │       ├── debug-code.SKILL.md
│   │       └── generate-docs.SKILL.md
│   └── ...
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
cd my-agent-skills
bun install
```

### 2. 设置 API Key

```bash
export ANTHROPIC_API_KEY=sk-ant-your-key-here
```

### 3. 运行

```bash
# Skills 模式（推荐）
bun run ./src/cli/skills-cli.ts

# MCP 模式
bun run ./src/cli/mcp-cli.ts
```

## Skills 功能

### 什么是 Agent Skills？

Agent Skills 是一种让 Agent 在特定场景下自动激活特定工作流程的机制。它兼容 Claude Code 的 SKILL.md 格式。

### SKILL.md 格式

```markdown
# Skill Name

---
name: Skill Name
description: 技能描述
tags: tag1, tag2
version: 1.0.0
---

## Trigger

### Keywords
- review
- test
- debug

### Patterns
- /\breview\b/i

## Usage

使用这个技能的说明...

## Steps

1. 第一步
2. 第二步
3. 第三步

## Tools

- read
- bash

## Constraints

- 约束条件1
- 约束条件2
```

### 触发条件

| 类型 | 说明 | 示例 |
|------|------|------|
| `Keywords` | 关键词匹配 | `review`, `test`, `debug` |
| `Patterns` | 正则/Glob 匹配 | `/\breview\b/i`, `*.test.ts` |
| `File Types` | 文件类型 | `.ts`, `.py` |

## 内置示例技能

| 技能 | 触发词 | 说明 |
|------|--------|------|
| `Code Review` | review, audit, check | 代码审查 |
| `Write Tests` | test, spec, coverage | 测试生成 |
| `Debug Code` | debug, fix, error, bug | 代码调试 |
| `Generate Docs` | docs, readme, document | 文档生成 |

## 安装技能

### 1. 复制示例技能

```bash
mkdir -p ~/.myagent/skills
cp -r src/skills/examples/* ~/.myagent/skills/
```

### 2. 创建自定义技能

创建 `~/.myagent/skills/my-skill.SKILL.md`:

```markdown
# My Custom Skill

---
name: My Custom Skill
description: Custom skill description
tags: custom
---

## Trigger

### Keywords
- custom keyword
- trigger word

## Steps

1. Do something
2. Do something else
```

### 3. 技能自动匹配

当你的消息包含触发词时，技能会自动激活：

```
❯ Can you review this code?

📚 Active skills:
   • Code Review
     Perform comprehensive code review...

🤖 Assistant:
   I'll help you review this code following the code review process...
```

## Skills 命令

| 命令 | 说明 |
|------|------|
| `/skills, /s` | 列出所有技能 |
| `/skill <name>` | 显示技能详情 |
| `/skill:enable <name>` | 启用技能 |
| `/skill:disable <name>` | 禁用技能 |
| `/mcp` | 显示 MCP 服务器状态 |

## Skills API

```typescript
import { SkillsManager } from "./skills"

// 创建管理器
const skillsManager = new SkillsManager()

// 加载技能
await skillsManager.load()

// 匹配技能
const matches = skillsManager.matchSkills({
  userMessage: "Please review this code",
  cwd: process.cwd(),
  env: process.env,
})

// 推荐技能
const recommended = skillsManager.recommendSkills("debug this error")

// 生成系统提示
const prompt = skillsManager.generateSystemPrompt(recommended)
```

## 匹配算法

| 匹配类型 | 分数 | 说明 |
|----------|------|------|
| 关键词匹配 | +20 | 消息包含触发关键词 |
| 名称匹配 | +25 | 消息包含技能名称 |
| 模式匹配 | +30 | 正则/Glob 匹配 |
| 标签匹配 | +15 | 消息包含标签词 |
| 文件类型 | +5/个 | 涉及特定文件类型 |

## 示例启动界面

```
┌────────────────────────────────────────────────────────────┐
│  My Agent - Skills Mode                                   │
├────────────────────────────────────────────────────────────┤
│  ✨ Agent Skills (SKILL.md compatible)                    │
│  📚 4 skills loaded (4 enabled)                          │
│  🔌 15 MCP tools available                                 │
├────────────────────────────────────────────────────────────┤
│  Skills auto-match based on your message                  │
│  Type /help for commands                                  │
└────────────────────────────────────────────────────────────┘

📚 Loading skills...
Loaded 4 skills from /Users/xxx/.myagent/skills

🔌 Initializing MCP servers...
  ✓ filesystem (5 tools)
  ✓ github (12 tools)
```

## 下一步

- 添加更多示例技能
- 创建技能市场
- 技能版本管理
- 技能依赖关系
