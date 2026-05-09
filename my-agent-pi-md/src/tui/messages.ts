// ============================================================
// TUI Messages - 消息渲染（支持 Markdown）
// ============================================================

import { colors, color } from "./colors";
import { Markdown, defaultMarkdownTheme, type DefaultTextStyle } from "./markdown";
import { wrapTextWithAnsi } from "./utils";
import type { Message } from "../types";

// ============================================================
// 消息条目
// ============================================================

export interface MessageEntry {
	id: string;
	type: "user" | "assistant" | "tool" | "thinking" | "system";
	content: string;
	toolName?: string;
	timestamp: Date;
}

// ============================================================
// 消息样式配置
// ============================================================

interface MessageStyle {
	prefix: string;
	borderColor: string;
	contentStyle?: DefaultTextStyle;
}

// 前缀文本映射
const messagePrefixText: Record<MessageEntry["type"], string> = {
	user: "👤 You",
	assistant: "🤖 Assistant",
	tool: "🔧 Tool",
	thinking: "💭 Thinking",
	system: "⚙️  System",
};

const messageStyles: Record<MessageEntry["type"], MessageStyle> = {
	user: {
		prefix: colors.cyan,
		borderColor: colors.dim,
	},
	assistant: {
		prefix: colors.green,
		borderColor: colors.dim,
	},
	tool: {
		prefix: colors.yellow,
		borderColor: colors.dim,
	},
	thinking: {
		prefix: colors.magenta,
		borderColor: colors.dim,
		contentStyle: {
			color: (text: string) => `${colors.dim}${text}${colors.reset}`,
			italic: true,
		},
	},
	system: {
		prefix: colors.dim,
		borderColor: colors.dim,
	},
};

// ============================================================
// 渲染函数
// ============================================================

/**
 * 渲染单条消息
 */
export function renderMessage(msg: MessageEntry, maxWidth: number): string[] {
	const lines: string[] = [];
	const padding = "  ";
	const borderWidth = Math.min(40, maxWidth - padding.length - 4);

	switch (msg.type) {
		case "user":
		case "assistant":
		case "tool": {
			lines.push("");
			lines.push(color(`${padding}${messagePrefixText[msg.type]}`, messageStyles[msg.type].prefix));
			lines.push(
				color(`${padding}${"─".repeat(borderWidth)}`, messageStyles[msg.type].borderColor),
			);

			// 使用 Markdown 渲染
			const md = new Markdown(
				msg.content,
				padding.length,
				0,
				defaultMarkdownTheme,
				messageStyles[msg.type].contentStyle,
			);
			const mdLines = md.render(maxWidth);

			// 跳过垂直 padding，只保留内容
			for (const line of mdLines) {
				lines.push(line.trimEnd());
			}
			lines.push("");
			break;
		}

		case "thinking": {
			lines.push("");
			lines.push(color(`${padding}${messagePrefixText.thinking}`, messageStyles.thinking.prefix));
			lines.push(
				color(`${padding}${"─".repeat(borderWidth)}`, messageStyles.thinking.borderColor),
			);

			// 思考内容使用 Markdown 渲染，带灰色斜体样式
			const md = new Markdown(
				msg.content,
				padding.length,
				0,
				defaultMarkdownTheme,
				{
					color: (text: string) => `${colors.dim}${text}${colors.reset}`,
					italic: true,
				},
			);
			const mdLines = md.render(maxWidth);
			for (const line of mdLines) {
				lines.push(line.trimEnd());
			}
			lines.push("");
			break;
		}

		case "system": {
			lines.push("");
			lines.push(color(`${padding}${messagePrefixText.system}`, messageStyles.system.prefix));
			lines.push(...wrapTextWithAnsi(msg.content, maxWidth - padding.length));
			lines.push("");
			break;
		}
	}

	return lines;
}

/**
 * 渲染纯文本消息（无 Markdown）
 */
export function renderMessagePlain(msg: MessageEntry, maxWidth: number): string[] {
	const lines: string[] = [];
	const padding = "  ";
	const borderWidth = Math.min(40, maxWidth - padding.length - 4);

	switch (msg.type) {
		case "user":
		case "assistant":
		case "tool": {
			lines.push("");
			lines.push(color(`${padding}${messagePrefixText[msg.type]}`, messageStyles[msg.type].prefix));
			lines.push(
				color(`${padding}${"─".repeat(borderWidth)}`, messageStyles[msg.type].borderColor),
			);
			lines.push(...wrapTextWithAnsi(msg.content, maxWidth - padding.length));
			lines.push("");
			break;
		}

		case "thinking": {
			lines.push("");
			lines.push(color(`${padding}${messagePrefixText.thinking}`, messageStyles.thinking.prefix));
			lines.push(
				color(`${padding}${"─".repeat(borderWidth)}`, messageStyles.thinking.borderColor),
			);
			lines.push(...wrapTextWithAnsi(msg.content, maxWidth - padding.length));
			lines.push("");
			break;
		}

		case "system": {
			lines.push("");
			lines.push(color(`${padding}${messagePrefixText.system}`, messageStyles.system.prefix));
			lines.push(...wrapTextWithAnsi(msg.content, maxWidth - padding.length));
			lines.push("");
			break;
		}
	}

	return lines;
}

/**
 * 渲染消息列表
 */
export function renderMessages(messages: MessageEntry[], maxWidth: number): string {
	const output: string[] = [];

	for (const msg of messages) {
		output.push(...renderMessage(msg, maxWidth));
	}

	return output.join("\n");
}

/**
 * 将 Agent Message 转换为 MessageEntry
 */
export function messageToEntry(msg: Message, id: string): MessageEntry {
	let type: MessageEntry["type"] = "system";
	let content = msg.content;
	let toolName: string | undefined;

	switch (msg.role) {
		case "user":
			type = "user";
			break;
		case "assistant":
			type = "assistant";
			break;
		case "tool":
			type = "tool";
			toolName = msg.toolName;
			break;
	}

	return {
		id,
		type,
		content,
		toolName,
		timestamp: new Date(),
	};
}

// ============================================================
// 工具函数
// ============================================================

/**
 * 检测文本是否包含 Markdown 格式
 */
export function hasMarkdown(text: string): boolean {
	// 简单的 Markdown 检测
	const patterns = [
		/^#{1,6}\s/m, // 标题
		/\*\*[^*]+\*\*/, // 粗体
		/\*[^*]+\*/, // 斜体
		/`[^`]+`/, // 行内代码
		/```[\s\S]*?```/, // 代码块
		/^\s*[-*+]\s/m, // 无序列表
		/^\s*\d+\.\s/m, // 有序列表
		/^\s*>\s/m, // 引用
		/\|.+\|/, // 表格
		/---/, // 分隔线
		/\[.+?\]\(.+?\)/, // 链接
		/~~.+?~~/, // 删除线
	];

	return patterns.some((pattern) => pattern.test(text));
}
