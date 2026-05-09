# 从错位表格到稳定渲染：TUI 中 Markdown 表格处理的工程经验

在命令行里渲染 Markdown，看起来只是把文本打印出来。但当输出里出现表格、中文、emoji、ANSI 颜色和模型返回的 HTML 实体时，问题会迅速从「字符串拼接」变成「终端排版系统」。

这次 `my-agent-pi-md` 的 CLI 表格问题，表面上是 Markdown 表格渲染不稳定，实际暴露的是 TUI 渲染里几个容易被低估的基础问题：

- 终端宽度不等于字符串长度。
- Markdown parser 的 token 文本不一定等于最终展示文本。
- 表格是结构化内容，不能只按行处理。
- ANSI 样式会污染长度计算，但又必须在换行时被保留。

本文整理这次修复的思路，作为后续构建 TUI Markdown 渲染能力的经验沉淀。

## 问题现场

Agent 在 CLI 中输出 Markdown 表格时，典型输入类似：

```markdown
| 项目 | 内容 |
|------|------|
| 身份 | Senior Developer & Mentor |
| 核心原则 | 解释 "为什么" 而非仅 "如何做" |
| 状态 | ✅ 已完成 |
```

期望输出是一个边框稳定、列宽正确的终端表格。但实际会出现几类问题：

- `&` 被显示成 `&amp;`。
- `"` 被显示成 `&quot;`。
- 中文和 emoji 让右边框错位。
- 某些行缺少单元格时，整行列数和表头不一致。
- inline markdown 样式插入 ANSI code 后，padding 计算失真。

这些问题的共同点是：它们不是 Markdown 语法问题，而是终端渲染模型问题。

## 根因一：不能用 `string.length` 做终端布局

在浏览器里，布局由渲染引擎处理；在终端里，布局通常靠程序自己补空格。如果用 `string.length` 计算列宽，会马上踩坑。

例如：

```ts
"A".length      // 1
"中".length     // 1
"✅".length     // 1 或 2，取决于 JS 字符串编码细节
"\x1b[1mA\x1b[0m".length // 10
```

但在终端里：

- ASCII 通常占 1 列。
- CJK 字符通常占 2 列。
- emoji 通常占 2 列。
- ANSI escape code 不占可见宽度。

所以 TUI 渲染必须建立一个核心概念：**visible width**。

这次实现里，`visibleWidth()` 负责计算字符串在终端中的可见列宽。它会处理：

- ANSI escape code。
- CJK East Asian Width。
- emoji grapheme cluster。
- zero-width code point。
- tab 转换。

有了可见宽度，padding 才能可靠：

```ts
export function padVisibleEnd(text: string, width: number): string {
  const padding = Math.max(0, width - visibleWidth(text));
  return text + " ".repeat(padding);
}
```

这个 helper 后续不只用于 Markdown 表格，也可以用于 banner、帮助面板、状态面板等所有固定宽度 TUI 元素。

## 根因二：Markdown token 里的文本可能已经被实体编码

`marked` 会把一些字符编码成 HTML entity。比如表格单元格里的 `&` 可能进入 token 后变成 `&amp;`，引号可能变成 `&quot;`。

如果渲染器直接输出 token text，就会把实体原样打印到 CLI：

```text
Senior Developer &amp; Mentor
解释 &quot;为什么&quot;
```

解决方式不是只在表格里做特殊处理，而是在 inline token 渲染路径中统一解码：

```ts
function decodeHtmlEntities(text: string): string {
  if (!text.includes("&")) return text;
  return text.replace(HTML_ENTITY_REGEX, (match) => HTML_ENTITIES[match] || match);
}
```

然后在 `text`、`codespan`、`html` 等 token 类型中统一使用。

经验是：**Markdown AST 是中间表示，不是最终展示文本**。渲染器要负责把中间表示转换成目标环境需要的文本。

## 根因三：表格要按结构渲染，而不是按行猜

早期表格处理容易走向「逐行识别」：

- 判断这一行是不是 `| A | B |`。
- 判断下一行是不是 `|---|---|`。
- 按 `|` split。
- 再拼边框。

这对简单英文表格能工作，但边界情况很多：

- cell 里有 inline markdown。
- cell 里有 HTML entity。
- 某行 cell 数量少于 header。
- 对齐规则是 `:---`、`:---:`、`---:`。
- 宽字符导致 `.padEnd()` 不可靠。

更稳的方案是直接使用 Markdown parser 产出的 table token：

```ts
private renderTable(token: Tokens.Table, availableWidth: number): string[] {
  const numCols = token.header.length;
  // 以 header 作为稳定 schema
}
```

这里最关键的原则是：**以 header 列数作为表格 schema**。

数据行不直接按 `row.length` 渲染，而是固定遍历 `numCols`：

```ts
const rowCellLines = Array.from({ length: numCols }, (_, i) => {
  const text = this.renderTableCellText(row[i], styleContext);
  return this.wrapCellText(text, columnWidths[i]);
});
```

如果某行缺少单元格，`renderTableCellText(undefined)` 返回空字符串。这样输出的列数始终稳定。

## 列宽计算：自然宽度、最小宽度和可用宽度

表格列宽不能只取最大内容长度。终端宽度有限，长文本需要换行，短文本不该浪费空间。

这次实现大致分三步：

1. 计算每列自然宽度：header 和 body 中该列所有内容的最大可见宽度。
2. 计算每列最小宽度：最长单词宽度，但设置上限，避免一个超长 token 撑爆表格。
3. 如果自然宽度总和超过终端宽度，就按增长潜力比例压缩列宽。

核心目标不是做一个完美排版引擎，而是在 CLI 中保持两个性质：

- 表格整体不超过可用宽度。
- 内容尽量可读，必要时在单元格内换行。

## 单元格渲染：先渲染 inline，再计算宽度

表格单元格可能包含：

```markdown
**bold**
`code`
[link](https://example.com)
~~deleted~~
```

所以列宽计算不能直接用原始 markdown 文本。正确流程是：

1. 先把 cell 的 inline token 渲染成带 ANSI 样式的终端文本。
2. 用 `visibleWidth()` 计算可见宽度。
3. 用 `wrapTextWithAnsi()` 在单元格宽度内换行。
4. 用 `padTableCell()` 按对齐规则补齐。

抽出的 helper 是：

```ts
private renderTableCellText(cell: Tokens.TableCell | undefined): string {
  if (!cell) return "";
  if (cell.tokens && cell.tokens.length > 0) {
    return this.renderInlineTokens(cell.tokens);
  }
  return decodeHtmlEntities(cell.text ?? "");
}
```

这保证 header 和 body 使用同一条渲染路径。

## 对齐规则：尊重 Markdown 表格语义

Markdown 表格支持三种常见对齐方式：

```markdown
| Left | Center | Right |
|:-----|:------:|------:|
```

终端里对齐就是 padding 分配：

```ts
private padTableCell(text: string, width: number, align = null): string {
  const padding = Math.max(0, width - visibleWidth(text));

  if (align === "right") {
    return " ".repeat(padding) + text;
  }

  if (align === "center") {
    const left = Math.floor(padding / 2);
    const right = padding - left;
    return " ".repeat(left) + text + " ".repeat(right);
  }

  return text + " ".repeat(padding);
}
```

这里仍然基于 `visibleWidth()`，否则中文和 emoji 会让居中看起来偏移。

## ANSI 样式和换行：不能简单 slice

为了让 Markdown 在 CLI 里更易读，渲染器会给标题、粗体、代码、链接等内容加 ANSI 样式。

这带来一个额外问题：如果换行时直接 `slice()` 字符串，可能把 ANSI code 切断，导致后续整屏颜色异常。

因此需要 `wrapTextWithAnsi()`：

- 识别 ANSI escape code。
- 计算纯文本的可见宽度。
- 换行时保留仍然生效的样式。
- 在必要位置补 reset，避免样式泄漏。

经验是：**样式是渲染状态，不是普通字符**。只要输出里有 ANSI，就不能再把字符串当纯文本处理。

## 这次修复后的验证方式

表格渲染不能只靠肉眼看一次。建议保留固定样例，覆盖以下情况：

```markdown
| 功能名称 | 描述 | 状态 |
|----------|------|------|
| 用户管理 | 管理用户账号和权限 | ✅ 已完成 |
| 数据分析 | 分析数据并生成报告 | 🔄 进行中 |
| API 接口 | 提供 RESTful API | ❌ 未开始 |

| Left | Center | Right | Missing |
|:-----|:------:|------:|---------|
| A & B | 中文✅ | 123 | ok |
| short | only two |
| **bold** | `code & x` | 9 | "quote" |
```

验证点：

- HTML entity 是否被还原。
- 中文和 emoji 是否保持边框对齐。
- 缺失单元格是否补空列。
- inline markdown 是否保留样式且不影响列宽。
- 每一行 `visibleWidth(line)` 是否一致或不超过目标宽度。

这次使用的验证命令包括：

```bash
bun run typecheck
bun run test-table.ts
```

还额外用固定宽度样例检查了每行可见宽度。

## 延伸：banner 也是表格问题

后续优化 welcome banner 时，又遇到了同类问题。

banner 不是 Markdown 表格，但本质上也是固定宽度盒模型：

```text
┌────────────────────────┐
│ My Agent               │
│ 🤖 Model: MiniMax      │
└────────────────────────┘
```

如果用 `.padEnd(60)`，遇到 emoji、中文、ANSI 颜色或长模型名，右边框一样会错位。

因此 banner 也应该复用同一套基础能力：

- `visibleWidth()`
- `truncateToWidth()`
- `padVisibleEnd()`

这说明一个经验：**表格修复不要只停在表格组件里，要沉淀成 TUI 布局基础设施**。

## 最终经验

这次修复可以沉淀为几条 TUI Markdown 渲染原则：

1. 终端布局以可见宽度为准，不以字符串长度为准。
2. ANSI escape code 必须在宽度计算中忽略，但在换行时保留状态。
3. Markdown AST 需要经过目标环境适配，不能直接输出 token text。
4. 表格应以 header 作为 schema，body 行按 schema 补齐。
5. inline markdown 应先渲染，再参与宽度计算和换行。
6. 固定宽度 UI，如表格、banner、help 面板，应共享同一套 padding 和截断工具。
7. 对 TUI 布局问题，自动化验证至少要检查每行可见宽度。

## 小结

CLI 中的 Markdown 表格不是简单文本美化，而是一个小型排版问题。只要进入 TUI 场景，就要同时考虑 Markdown 语义、终端宽度、ANSI 状态、Unicode 宽字符和内容结构。

这次构建的关键收获是：把「修一个表格」升级为「建立可复用的终端布局能力」。当 `visibleWidth()`、`wrapTextWithAnsi()`、`truncateToWidth()`、`padVisibleEnd()` 这些基础能力稳定后，表格、banner、帮助面板、状态栏都会受益。
