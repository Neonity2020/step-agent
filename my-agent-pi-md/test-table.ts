// Quick test for table rendering with CJK, emoji, and HTML entities
import { renderMarkdown } from "./src/tui/markdown";

const testTable = `
| 功能名称 | 描述 | 状态 |
|----------|------|------|
| 用户管理 | 管理用户账号和权限 | ✅ 已完成 |
| 数据分析 | 分析数据并生成报告 | 🔄 进行中 |
| API 接口 | 提供 RESTful API | ❌ 未开始 |

## 自我介绍

| 项目 | 内容 |
|------|------|
| 身份 | Senior Developer & Mentor |
| 性格特点 | 耐心、细致、鼓励性、注重细节 |
| 核心原则 | 代码质量优于速度；解释 "为什么" 而非仅 "如何做" |
| 擅长语言 | TypeScript、Python、Go |

Here is a simple English table:

| Name | Age | City |
|------|-----|------|
| Alice | 30 | NYC |
| Bob | 25 | London |
| Charlie | 35 | Tokyo |
`;

const width = process.stdout.columns || 80;
console.log(`Terminal width: ${width}`);
console.log("=".repeat(width));
console.log(renderMarkdown(testTable, width));
console.log("=".repeat(width));
