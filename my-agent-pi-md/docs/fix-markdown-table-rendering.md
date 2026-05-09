# 修复日志：CLI Markdown 表格渲染

## 背景

Agent 在 CLI 中输出 Markdown 表格时，表格内容会受到终端宽度、ANSI 样式、CJK 宽字符、emoji 和 HTML 实体的影响。手工拼接或按字符串长度计算列宽时，容易出现边框错位、内容换行异常、实体未解码等问题。

## 现象

- 单元格中的 `&`、`"` 等字符被显示为 `&amp;`、`&quot;`。
- 表格行如果缺少单元格，渲染出的列数可能与表头不一致。
- 中文、emoji、ANSI 颜色样式混合时，需要按终端可见宽度计算，而不是按字符串长度计算。

## 根因

- `marked` 解析 inline token 时会对部分字符做 HTML entity 编码，表格渲染路径没有统一解码。
- 表格数据行直接按实际 cell 数渲染，未按 header 列数补齐。
- CLI 输出需要同时处理 ANSI escape code 和 East Asian Width，否则 padding 会偏移。

## 修复

- 在 inline token 渲染中统一解码常见 HTML entities。
- 新增表格单元格渲染 helper，保证 header、body、fallback 文本路径一致。
- 数据行按表头列数固定输出，缺失单元格补空字符串。
- 支持 Markdown 表格的左对齐、居中、右对齐。
- 使用可见宽度计算 padding，兼容中文、emoji 和 ANSI 样式。

## 验证

- `bun run typecheck`
- `bun run test-table.ts`
- 额外验证 60 列宽度下，中文、emoji、inline markdown、对齐和缺失单元格混合表格的每一行可见宽度一致。

## 经验沉淀

- 终端 UI 中不要用 `string.length` 做布局，应使用可见宽度计算。
- Markdown AST 中的 `text` 不一定等于最终应展示文本，需要统一处理实体解码。
- 表格渲染应以 schema 为准，也就是以 header 列数作为稳定列模型。
- 对表格这类固定结构，渲染后要用固定宽度样例做行宽校验，避免只靠肉眼判断。
