# My Agent - Skills Evolution

> 🧬 **Skills 自进化**：让 Agent 自动总结工作流，生成新 Skills
> 🌐 **Web UI**：浏览器中的图形化界面
> 🔒 **Sandbox**：沙箱安全保护
> 🚪 **Gateway**：REST API 网关

## 核心功能

```
┌─────────────────────────────────────────────────────────────┐
│                    Skills Evolution                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│   ┌─────────┐    工作流检测    ┌──────────┐                 │
│   │ 对话    │ ──────────────→ │ Workflow │                  │
│   │ 过程    │                  │ Detector │                  │
│   └─────────┘                  └──────────┘                 │
│                                     │                        │
│                                     ▼                        │
│                              ┌──────────────┐                │
│                              │ Pattern      │                │
│                              │ Recognition  │                │
│                              └──────────────┘                │
│                                     │                        │
│                                     ▼                        │
│                              ┌──────────────┐                │
│                              │ Skill        │                │
│                              │ Generator    │                │
│                              └──────────────┘                │
│                                     │                        │
│                                     ▼                        │
│                              ┌──────────────┐                │
│                              │ SKILL.md     │                │
│                              │ 文件生成      │                │
│                              └──────────────┘                │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## 项目结构

```
my-agent-pi-md/
├── src/
│   ├── cli/
│   │   ├── evolution-cli.ts    # 主 CLI (自进化 + 模型选择)
│   │   ├── web-cli.ts          # Web UI 启动器 ← 新增
│   │   └── ...
│   ├── providers/              # Provider 配置
│   │   ├── config.ts          # Provider 和模型配置
│   │   ├── selector.ts        # 交互式选择器
│   │   └── context.ts         # 全局模型状态
│   ├── web/                    # Web UI ← 新增
│   │   ├── server.ts          # HTTP 服务器
│   │   ├── types.ts          # 类型定义
│   │   └── index.ts
│   ├── public/                 # 静态文件 ← 新增
│   │   ├── index.html         # 主页面
│   │   ├── styles.css         # 样式
│   │   └── app.js             # 前端 JS
│   ├── skills-evolution/       # 自进化模块
│   ├── pimd/                   # Pi.md 模块
│   ├── soul/                   # SOUL.md 模块
│   └── ... (复用所有功能)
└── README.md
```

## 快速开始

```bash
cd my-agent-pi-md
bun install
export ANTHROPIC_API_KEY=sk-ant-...

# 启动 CLI 版本
bun run ./src/cli/evolution-cli.ts

# 启动 Web UI 版本
bun run ./src/cli/web-cli.ts
# 然后打开 http://localhost:3000

# 启动 API Gateway
bun run ./src/cli/gateway-cli.ts
# 然后访问 http://localhost:8080
```

## Gateway - REST API

### 启动

```bash
# 基本启动（端口 8080）
bun run gateway

# 自定义端口
bun run gateway --port=3000

# 禁用日志
bun run gateway --no-logging
```

### API 端点

| 方法 | 端点 | 描述 | 权限 |
|------|------|------|------|
| GET | `/health` | 健康检查 | - |
| POST | `/api/chat` | 发送消息 | `chat:send` |
| GET | `/api/chat/:sessionId` | 获取聊天历史 | `chat:read` |
| GET | `/api/sessions` | 列出会话 | `session:list` |
| POST | `/api/sessions` | 创建会话 | `session:create` |
| DELETE | `/api/sessions/:sessionId` | 删除会话 | `session:delete` |
| GET | `/api/models` | 列出模型 | `model:list` |
| GET | `/api/stats` | 获取统计 | `stats:read` |
| GET | `/api/keys` | 列出 API Keys | `admin` |
| POST | `/api/keys` | 创建 API Key | `admin` |

### 认证

```bash
# Bearer Token
curl -H "Authorization: Bearer <api-key>" ...


# X-API-Key Header
curl -H "X-API-Key: <api-key>" ...
```

### 示例请求

```bash
# 发送消息
curl -X POST http://localhost:8080/api/chat \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer sk_xxx" \
  -d '{"message": "Hello!", "sessionId": "sess_123"}'


# 响应
{
  "success": true,
  "data": {
    "sessionId": "sess_123",
    "messageId": "msg_xxx",
    "content": "Hello! How can I help?"
  },
  "meta": {
    "requestId": "req_xxx",
    "timestamp": 1234567890
  }
}
```

### 限流

默认：`100 请求/分钟`

响应头：
- `X-RateLimit-Remaining` - 剩余请求数
- `X-RateLimit-Limit` - 限制数
- `X-RateLimit-Reset` - 重置时间

### API Key 权限

| 权限 | 描述 |
|------|------|
| `chat:send` | 发送消息 |
| `chat:read` | 读取聊天历史 |
| `session:create` | 创建会话 |
| `session:read` | 读取会话 |
| `session:list` | 列出会话 |
| `session:delete` | 删除会话 |
| `model:list` | 列出模型 |
| `stats:read` | 读取统计 |
| `admin` | 完全访问 |

## Web UI

### 启动

```bash
# 基本启动
bun run web

# 交互式配置
bun run web:dev

# 自定义端口
bun run ./src/cli/web-cli.ts --port=8080

# 自定义主题
bun run ./src/cli/web-cli.ts --theme=light
```

### 界面功能

| 功能 | 说明 |
|------|------|
| 🌙/☀️ 主题切换 | Dark/Light/Nord/Monokai 四种主题 |
| 💬 多会话 | 支持多个聊天会话 |
| ⚡ 流式输出 | 实时显示 AI 响应 |
| ⚙️ 设置面板 | 配置主题和其他选项 |
| 📱 响应式设计 | 支持移动端 |

## Sandbox - 沙箱保护

### /sandbox 命令

```bash
# 查看沙箱状态
/sandbox status

# 列出所有策略
/sandbox list

# 设置策略
/sandbox set balanced

# 启用/禁用沙箱
/sandbox enable
/sandbox disable

# 试运行模式（模拟执行）
/sandbox dryrun

# 打印安全报告
/sandbox report

# 测试命令
/sandbox test rm -rf /
```

### 安全策略

| 策略 | 说明 | 安全级别 |
|------|------|----------|
| `strict` | 最大安全，最小权限 | 🔴🔴🔴 |
| `balanced` | 良好安全，合理灵活性（默认） | 🟡🟡 |
| `development` | 开发模式 | 🟢 |
| `readonly` | 只读，不能修改文件 | 🔴🔴 |
| `git` | 仅安全的 Git 操作 | 🟡 |
| `admin` | 完全访问权限 | ⚫ |

### 危险命令检测

```
⛔ Command Blocked by Sandbox
Reason: Attempting to delete root directory

Policy: Balanced

The command "rm -rf /" was blocked for security reasons.
```

### 自动阻止的操作

| 模式 | 描述 |
|------|------|
| `rm -rf /` | 删除根目录 |
| `dd if=.*of=/dev/` | 直接磁盘写入 |
| `sudo su` | 提权尝试 |
| `wget.*\|sh` | 下载并执行 |
| `fork bomb` | Fork 炸弹 |
| `chmod 777 /` | 危险权限 |

## /model 命令

```bash
# 完整选择（Provider → Model → MaxTokens → Temperature → Iterations）
/model

# 快速切换（直接选择可用 Provider）
/model quick

# 查看当前配置
/model show

# 列出所有可用模型
/model list

# 重置为默认
/model reset
```

### 支持的 Providers

| Provider | API Key | 模型 |
|----------|---------|------|
| **Anthropic** | ANTHROPIC_API_KEY | Claude Opus/Sonnet/Haiku |
| **OpenAI** | OPENAI_API_KEY | GPT-4o/4/3.5 |
| **Google** | GOOGLE_API_KEY | Gemini 1.5/2.0 |
| **Mistral** | MISTRAL_API_KEY | Mistral Large/Small |
| **Groq** | GROQ_API_KEY | Llama 3.1/Mixtral |
| **DeepSeek** | DEEPSEEK_API_KEY | DeepSeek V3/Coder |
| **xAI** | XAI_API_KEY | Grok 2/2 Mini |
| **Cohere** | COHERE_API_KEY | Command R+ |

### 完整选择流程

```
[Step 1/4] Choose Provider
  [1] ● Anthropic    Claude models
  [2] ○ OpenAI       GPT models
  ...
  Enter number: 1
  ✓ Selected: Anthropic

[Step 2/4] Choose Model
  [1] Claude Opus 4     claude-opus-4-20250514
  [2] Claude Sonnet 4   claude-sonnet-4-20250514  ◄
  ...
  Enter number: 2
  ✓ Selected: Claude Sonnet 4

[Step 3/4] Choose Max Output Tokens
  [1] 1K - Concise
  [2] 2K - Standard
  [3] 4K - Detailed
  [4] 8K - Extended  ◄
  ...

[Step 4/4] Choose Temperature
  [1] 0.0 - Deterministic
  [3] 0.5 - Balanced  ◄
  ...

[Bonus] Choose Iteration Count
  [1] 1 - Single response
  [2] 3 - Quick iteration  ◄
  ...
```

### Max Tokens 选项

| 值 | 说明 |
|----|------|
| 1K | 简洁回答 |
| 2K | 标准回答 |
| 4K | 详细回答 |
| 8K | 扩展回答 |
| 16K | 长回答 |
| 32K | 超长回答 |
| 64K | 最大 |

### Temperature 说明

| 值 | 说明 | 适用场景 |
|----|------|----------|
| 0.0 | 确定性 | 代码、精确任务 |
| 0.3 | 专注 | 常规任务 |
| 0.5 | 平衡 | 日常对话 |
| 0.7 | 创意 | 写作、头脑风暴 |
| 1.0 | 非常创意 | 需要多样性 |
| 1.5 | 最大创意 | 实验性 |

## 自进化命令

| 命令 | 说明 |
|------|------|
| `/evolution stats` | 显示进化统计 |
| `/evolution patterns` | 显示常见工作流模式 |
| `/evolution review` | 审查候选技能 |
| `/evolution report` | 生成进化报告 |
| `/evolution enable` | 启用自动进化 |
| `/evolution disable` | 禁用自动进化 |

## 工作原理

### 1. 工作流检测

自动追踪 Agent 的操作序列：

```
User: Fix the login bug
  ↓
[Tool] read src/auth/login.ts
[Tool] bash npm test
[Tool] edit src/auth/login.ts
[Tool] bash npm test
  ↓
Workflow Detected: Bug Fix Pattern
```

### 2. 模式识别

识别常见工作流模式：

| 模式 | 描述 |
|------|------|
| `File Creation` | 创建文件并设置目录 |
| `Bug Fix` | 调试并修复问题 |
| `Code Review` | 审查代码并运行测试 |
| `Feature Development` | 读取、修改、测试代码 |
| `Test Driven Development` | 先写测试，再写代码 |
| `Refactoring` | 重构现有代码 |

### 3. 技能生成

自动生成 `SKILL.md` 文件：

```markdown
---
name: Bug Fix
description: Debug and fix issues
tags: [debugging, edit, bash]
version: 1.0.0
confidence: 85
category: debugging
generated: 2024-01-15T10:30:00Z
---

# Bug Fix

This skill performs a bug fix workflow...

## When to Use
Use this when you encounter bugs that need to be fixed.

## How to Use
1. Reproduce the bug
2. Read relevant code
3. Identify the issue
4. Fix the bug
5. Test the fix
```

### 4. 技能固化

候选技能经过审查后保存到 Skills 库：

```
~/.myagent/skills/
├── bug-fix.SKILL.md
├── code-review.SKILL.md
├── test-driven-dev.SKILL.md
└── ...
```

## 进化命令示例

```bash
# 查看进化统计
/evolution stats

# 输出:
# ┌────────────────────────────────────────────────────────────┐
# │ Skills Evolution Stats                                    │
# ├────────────────────────────────────────────────────────────┤
# │ Workflows Detected: 25                                    │
# │ Candidates Generated: 8                                   │
# │ Skills Published: 3                                       │
# │ Effectiveness: 78%                                        │
# └────────────────────────────────────────────────────────────┘

# 查看常见模式
/evolution patterns

# 输出:
# ┌────────────────────────────────────────────────────────────┐
# │ Common Workflow Patterns                                  │
# ├────────────────────────────────────────────────────────────┤
# │ read→edit→bash (15 times)                                │
# │ write→bash→edit (8 times)                                │
# │ read→bash→read→edit (5 times)                            │
# └────────────────────────────────────────────────────────────┘

# 审查候选
/evolution review

# 输出:
# [1] Bug Fix Workflow (85% confidence)
#     Automated bug fixing workflow with test verification
# [2] API Testing (72% confidence)
#     Testing REST API endpoints
```

## 自动 vs 手动

| 模式 | 说明 |
|------|------|
| **自动** | Agent 自动检测工作流，生成候选技能 |
| **手动** | 用户使用 `/evolution review` 审查并批准 |

### 启用/禁用

```bash
/evolution enable   # 启用自动进化
/evolution disable  # 禁用自动进化
```

## 存储位置

```
~/.myagent/
├── workflows/           # 检测到的工作流
│   ├── wf-123456.json
│   └── ...
├── skill-candidates/   # 候选技能
│   ├── skill-789.json
│   └── ...
└── skills/              # 已发布的 Skills
    ├── bug-fix.SKILL.md
    └── ...
```

## 置信度算法

```
Confidence = 基础分(50)
           + 步骤数加分(10-20)
           + 工具调用加分(10)
           + 推理说明加分(15)

最高: 95%
```

## 启动界面

```
┌────────────────────────────────────────────────────────────┐
│  My Agent - Skills Evolution                                │
├────────────────────────────────────────────────────────────┤
│  🧬 Skills Evolution - Self-improving Agent                 │
│  🎭 SOUL.md - Agent Personality                            │
│  📄 pi.md - Project Context                                │
├────────────────────────────────────────────────────────────┤
│  ✓ SOUL.md loaded                                          │
│  ✓ AGENTS.md loaded                                        │
│  Project: my-project                                       │
├────────────────────────────────────────────────────────────┤
│  🧬 Evolution: 25 workflows | 3 skills                      │
├────────────────────────────────────────────────────────────┤
│  Type /help for commands                                   │
└────────────────────────────────────────────────────────────┘
```

## 下一步

- [ ] LLM 辅助技能生成（更智能的抽象）
- [ ] 技能版本管理
- [ ] 技能效果追踪
- [ ] 技能推荐系统
- [ ] 多 Agent 技能共享
