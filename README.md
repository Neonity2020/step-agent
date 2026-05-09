# Pi Agent - 渐进式学习 Agent Harness

> 🧬 **Skills Evolution**: 自进化能力，自动总结工作流生成 Skills
> 🎭 **SOUL.md**: Agent 个性定制
> 📄 **pi.md / AGENTS.md**: 项目上下文支持
> 🌐 **Web UI**: 浏览器图形化界面
> 🚪 **Gateway**: REST API 网关
> 🛡️ **Sandbox**: 沙箱安全保护

## 项目结构

```
pi-agent/
├── my-agent-phase1~5        # 渐进式学习：基础功能
├── my-agent-mcp             # MCP (Model Context Protocol) 支持
├── my-agent-skills          # Skills 系统
├── my-agent-kb              # 知识库
└── my-agent-pi-md           # 完整版本（所有功能）
```

## 快速开始

```bash
cd my-agent-pi-md
cp .env.example .env
# 编辑 .env 填入 API Key

# CLI 模式
bun run dev

# Web UI 模式 (http://localhost:3000)
bun run web

# API Gateway (http://localhost:8080)
bun run gateway
```

## 支持的 LLM Provider

| Provider | 模型 |
|----------|------|
| Anthropic | Claude Sonnet 4, Claude Opus 4, Claude Haiku 4 |
| OpenAI | GPT-4o, GPT-4o Mini |
| Google | Gemini 2.0 Flash, Gemini 1.5 Pro |
| MiniMax | MiniMax-M2.7 |
| DeepSeek | DeepSeek V4 Pro, DeepSeek V4 Flash |
| 智谱 GLM | GLM-5.1, GLM-4.7 |
| (更多...) | |

## 核心命令

- `/model` - 选择 Provider 和模型
- `/soul init` - 初始化 Agent 个性
- `/init` - 初始化项目配置
- `/evolution` - 查看进化统计
- `/help` - 帮助信息

## License

MIT