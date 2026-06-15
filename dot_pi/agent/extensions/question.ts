/**
 * Question tool - lets the LLM ask the user questions during execution
 *
 * Registered as a tool the LLM calls when it needs user input.
 * Supports batched questions with optional multiple-choice options
 * and a free-text fallback. Interactive TUI with per-question navigation.
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import {
	type Component,
	Editor,
	type EditorTheme,
	Key,
	matchesKey,
	Text,
	truncateToWidth,
	type TUI,
	visibleWidth,
	wrapTextWithAnsi,
} from "@mariozechner/pi-tui";
import { Type } from "typebox";

// --- Types ---

interface QuestionInput {
	question: string;
	context?: string;
	options?: Array<{ label: string; description?: string }>;
}

interface DisplayOption {
	label: string;
	description?: string;
	isOther?: boolean;
}

interface PerQuestionState {
	optionIndex: number;
	inEditMode: boolean;
	answer: string;
	wasCustom: boolean;
}

interface QuestionResultDetails {
	questions: Array<{
		question: string;
		answer: string | null;
		wasCustom?: boolean;
	}>;
}

// --- Schema ---

const OptionSchema = Type.Object({
	label: Type.String({ description: "Display label (1-5 words, concise)" }),
	description: Type.Optional(Type.String({ description: "Explanation of the choice" })),
});

const QuestionSchema = Type.Object({
	question: Type.String({ description: "The question to ask" }),
	context: Type.Optional(Type.String({ description: "Context that helps the user answer" })),
	options: Type.Optional(
		Type.Array(OptionSchema, { description: "Options to choose from; a free-text fallback is added automatically" }),
	),
});

const QuestionParams = Type.Object({
	questions: Type.Array(QuestionSchema, { description: "Questions to ask the user" }),
});

// --- Component ---

class QnAComponent implements Component {
	private questions: QuestionInput[];
	private states: PerQuestionState[];
	private currentIndex: number = 0;
	private editor: Editor;
	private tui: TUI;
	private onDone: (result: PerQuestionState[] | null) => void;
	private showingConfirmation: boolean = false;

	private cachedWidth?: number;
	private cachedLines?: string[];

	private dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
	private bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
	private cyan = (s: string) => `\x1b[36m${s}\x1b[0m`;
	private green = (s: string) => `\x1b[32m${s}\x1b[0m`;
	private yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
	private gray = (s: string) => `\x1b[90m${s}\x1b[0m`;

	constructor(questions: QuestionInput[], tui: TUI, onDone: (result: PerQuestionState[] | null) => void) {
		this.questions = questions;
		this.states = questions.map(() => ({
			optionIndex: 0,
			inEditMode: false,
			answer: "",
			wasCustom: false,
		}));
		this.tui = tui;
		this.onDone = onDone;

		const editorTheme: EditorTheme = {
			borderColor: this.dim,
			selectList: {
				selectedBg: (s: string) => `\x1b[44m${s}\x1b[0m`,
				matchHighlight: this.cyan,
				itemSecondary: this.gray,
			},
		};

		this.editor = new Editor(tui, editorTheme);
		this.editor.disableSubmit = true;
		this.editor.onChange = () => {
			this.invalidate();
			this.tui.requestRender();
		};
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	handleInput(data: string): void {
		if (this.showingConfirmation) {
			this.handleConfirmationInput(data);
			return;
		}

		if (matchesKey(data, Key.ctrl("c"))) {
			this.cancel();
			return;
		}

		if (matchesKey(data, Key.escape)) {
			const state = this.states[this.currentIndex];
			if (this.hasOptions(this.currentIndex) && state.inEditMode) {
				state.inEditMode = false;
				this.editor.setText("");
				this.invalidate();
				this.tui.requestRender();
				return;
			}
			this.cancel();
			return;
		}

		// Ctrl-J (\n): insert newline when editor is active
		const editorActive = !this.hasOptions(this.currentIndex) || this.states[this.currentIndex].inEditMode;
		if (data === "\n" && editorActive) {
			this.editor.handleInput(data);
			this.invalidate();
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, Key.tab)) {
			if (this.currentIndex < this.questions.length - 1) {
				this.navigateTo(this.currentIndex + 1);
				this.tui.requestRender();
			}
			return;
		}
		if (matchesKey(data, Key.shift("tab"))) {
			if (this.currentIndex > 0) {
				this.navigateTo(this.currentIndex - 1);
				this.tui.requestRender();
			}
			return;
		}

		if (this.hasOptions(this.currentIndex)) {
			this.handleOptionsInput(data);
		} else {
			this.handleFreeTextInput(data);
		}
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) {
			return this.cachedLines;
		}

		const lines: string[] = [];
		const boxWidth = Math.min(width - 4, 120);
		const contentWidth = boxWidth - 4;

		const horizontalLine = (count: number) => "─".repeat(count);
		const boxLine = (content: string, leftPad: number = 2): string => {
			const paddedContent = " ".repeat(leftPad) + content;
			const contentLen = visibleWidth(paddedContent);
			const rightPad = Math.max(0, boxWidth - contentLen - 2);
			return this.dim("│") + paddedContent + " ".repeat(rightPad) + this.dim("│");
		};
		const emptyBoxLine = (): string => {
			return this.dim("│") + " ".repeat(boxWidth - 2) + this.dim("│");
		};
		const padToWidth = (line: string): string => {
			const len = visibleWidth(line);
			if (len > width) return truncateToWidth(line, width);
			return line + " ".repeat(width - len);
		};

		// Title
		lines.push(padToWidth(this.dim("╭" + horizontalLine(boxWidth - 2) + "╮")));
		const title = `${this.bold(this.cyan("Questions"))} ${this.dim(`(${this.currentIndex + 1}/${this.questions.length})`)}`;
		lines.push(padToWidth(boxLine(title)));
		lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));

		// Progress dots (only for multiple questions)
		if (this.questions.length > 1) {
			const progressParts: string[] = [];
			for (let i = 0; i < this.questions.length; i++) {
				const answered = this.states[i].answer.trim().length > 0;
				const current = i === this.currentIndex;
				if (current) {
					progressParts.push(this.cyan("●"));
				} else if (answered) {
					progressParts.push(this.green("●"));
				} else {
					progressParts.push(this.dim("○"));
				}
			}
			lines.push(padToWidth(boxLine(progressParts.join(" "))));
			lines.push(padToWidth(emptyBoxLine()));
		}

		// Current question text
		const q = this.questions[this.currentIndex];
		const state = this.states[this.currentIndex];
		const questionText = `${this.bold("Q:")} ${q.question}`;
		for (const line of wrapTextWithAnsi(questionText, contentWidth)) {
			lines.push(padToWidth(boxLine(line)));
		}

		// Context
		if (q.context) {
			lines.push(padToWidth(emptyBoxLine()));
			for (const line of wrapTextWithAnsi(this.gray(`> ${q.context}`), contentWidth - 2)) {
				lines.push(padToWidth(boxLine(line)));
			}
		}

		lines.push(padToWidth(emptyBoxLine()));

		// Answer area: options or free-text editor
		if (this.hasOptions(this.currentIndex)) {
			this.renderOptions(lines, boxLine, emptyBoxLine, padToWidth, contentWidth, state);
		} else {
			this.renderFreeText(lines, boxLine, padToWidth, contentWidth);
		}

		lines.push(padToWidth(emptyBoxLine()));

		// Footer
		this.renderFooter(lines, boxLine, padToWidth, horizontalLine, boxWidth, contentWidth, state);

		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	// --- Private: input handling (depth-first from handleInput) ---

	private handleConfirmationInput(data: string): void {
		if (matchesKey(data, Key.enter) || data.toLowerCase() === "y") {
			this.submit();
			return;
		}
		if (matchesKey(data, Key.escape) || matchesKey(data, Key.ctrl("c")) || data.toLowerCase() === "n") {
			this.showingConfirmation = false;
			this.invalidate();
			this.tui.requestRender();
		}
	}

	private submit(): void {
		this.saveCurrentState();
		this.onDone(this.states.slice());
	}

	private cancel(): void {
		this.onDone(null);
	}

	private navigateTo(index: number): void {
		if (index < 0 || index >= this.questions.length) return;
		this.saveCurrentState();
		this.currentIndex = index;
		this.restoreState(index);
		this.invalidate();
	}

	private saveCurrentState(): void {
		const state = this.states[this.currentIndex];
		if (this.hasOptions(this.currentIndex)) {
			if (state.inEditMode) {
				state.answer = this.editor.getText();
				state.wasCustom = true;
			}
		} else {
			state.answer = this.editor.getText();
			state.wasCustom = true;
		}
	}

	private restoreState(index: number): void {
		const state = this.states[index];
		if (this.hasOptions(index)) {
			if (state.wasCustom && state.answer) {
				state.inEditMode = true;
				this.editor.setText(state.answer);
			} else {
				state.inEditMode = false;
				this.editor.setText("");
				if (state.answer && !state.wasCustom) {
					const options = this.getDisplayOptions(index);
					const matchIdx = options.findIndex((o) => !o.isOther && o.label === state.answer);
					if (matchIdx >= 0) state.optionIndex = matchIdx;
				}
			}
		} else {
			this.editor.setText(state.answer);
		}
	}

	private hasOptions(index: number): boolean {
		const q = this.questions[index];
		return !!(q.options && q.options.length > 0);
	}

	private getDisplayOptions(index: number): DisplayOption[] {
		const q = this.questions[index];
		if (!q.options || q.options.length === 0) return [];
		return [...q.options, { label: "Type something.", isOther: true }];
	}

	private handleOptionsInput(data: string): void {
		const state = this.states[this.currentIndex];
		const options = this.getDisplayOptions(this.currentIndex);

		if (state.inEditMode) {
			if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
				const text = this.editor.getText().trim();
				if (text) {
					state.answer = text;
					state.wasCustom = true;
					this.advance();
				} else {
					state.inEditMode = false;
					this.editor.setText("");
					this.invalidate();
					this.tui.requestRender();
				}
				return;
			}
			this.editor.handleInput(data);
			this.invalidate();
			this.tui.requestRender();
			return;
		}

		if (matchesKey(data, Key.up)) {
			state.optionIndex = Math.max(0, state.optionIndex - 1);
			this.invalidate();
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, Key.down)) {
			state.optionIndex = Math.min(options.length - 1, state.optionIndex + 1);
			this.invalidate();
			this.tui.requestRender();
			return;
		}
		if (matchesKey(data, Key.enter)) {
			const selected = options[state.optionIndex];
			if (selected.isOther) {
				state.inEditMode = true;
				this.editor.setText(state.wasCustom ? state.answer : "");
				this.invalidate();
				this.tui.requestRender();
			} else {
				state.answer = selected.label;
				state.wasCustom = false;
				this.advance();
			}
		}
	}

	private handleFreeTextInput(data: string): void {
		if (matchesKey(data, Key.enter) && !matchesKey(data, Key.shift("enter"))) {
			const state = this.states[this.currentIndex];
			state.answer = this.editor.getText();
			state.wasCustom = true;
			this.advance();
			return;
		}

		if (matchesKey(data, Key.up) && this.editor.getText() === "") {
			if (this.currentIndex > 0) {
				this.navigateTo(this.currentIndex - 1);
				this.tui.requestRender();
				return;
			}
		}
		if (matchesKey(data, Key.down) && this.editor.getText() === "") {
			if (this.currentIndex < this.questions.length - 1) {
				this.navigateTo(this.currentIndex + 1);
				this.tui.requestRender();
				return;
			}
		}

		this.editor.handleInput(data);
		this.invalidate();
		this.tui.requestRender();
	}

	private advance(): void {
		if (this.currentIndex < this.questions.length - 1) {
			this.navigateTo(this.currentIndex + 1);
			this.tui.requestRender();
		} else {
			this.saveCurrentState();
			this.showingConfirmation = true;
			this.invalidate();
			this.tui.requestRender();
		}
	}

	// --- Private: render helpers (depth-first from render) ---

	private renderOptions(
		lines: string[],
		boxLine: (content: string, leftPad?: number) => string,
		emptyBoxLine: () => string,
		padToWidth: (line: string) => string,
		contentWidth: number,
		state: PerQuestionState,
	): void {
		const options = this.getDisplayOptions(this.currentIndex);
		for (let i = 0; i < options.length; i++) {
			const opt = options[i];
			const isHighlighted = i === state.optionIndex;
			const prefix = isHighlighted ? this.cyan("> ") : "  ";

			if (opt.isOther && state.inEditMode) {
				lines.push(padToWidth(boxLine(prefix + this.cyan(`${i + 1}. ${opt.label} ✎`))));
			} else if (isHighlighted && !state.inEditMode) {
				lines.push(padToWidth(boxLine(prefix + this.cyan(`${i + 1}. ${opt.label}`))));
			} else {
				lines.push(padToWidth(boxLine(`  ${i + 1}. ${opt.label}`)));
			}

			if (opt.description) {
				lines.push(padToWidth(boxLine(`     ${this.gray(opt.description)}`)));
			}
		}

		if (state.inEditMode) {
			lines.push(padToWidth(emptyBoxLine()));
			const editorWidth = contentWidth - 6;
			const editorLines = this.editor.render(editorWidth);
			for (let i = 1; i < editorLines.length - 1; i++) {
				lines.push(padToWidth(boxLine("  " + editorLines[i])));
			}
		}
	}

	private renderFreeText(
		lines: string[],
		boxLine: (content: string, leftPad?: number) => string,
		padToWidth: (line: string) => string,
		contentWidth: number,
	): void {
		const answerPrefix = this.bold("A: ");
		const editorWidth = contentWidth - 4 - 3;
		const editorLines = this.editor.render(editorWidth);
		for (let i = 1; i < editorLines.length - 1; i++) {
			if (i === 1) {
				lines.push(padToWidth(boxLine(answerPrefix + editorLines[i])));
			} else {
				lines.push(padToWidth(boxLine("   " + editorLines[i])));
			}
		}
	}

	private renderFooter(
		lines: string[],
		boxLine: (content: string, leftPad?: number) => string,
		padToWidth: (line: string) => string,
		horizontalLine: (count: number) => string,
		boxWidth: number,
		contentWidth: number,
		state: PerQuestionState,
	): void {
		lines.push(padToWidth(this.dim("├" + horizontalLine(boxWidth - 2) + "┤")));

		if (this.showingConfirmation) {
			const confirmMsg = `${this.yellow("Submit all answers?")} ${this.dim("(Enter/y to confirm, Esc/n to cancel)")}`;
			lines.push(padToWidth(boxLine(truncateToWidth(confirmMsg, contentWidth))));
		} else {
			let controls: string;
			if (this.hasOptions(this.currentIndex) && state.inEditMode) {
				controls = `${this.dim("Enter")} submit · ${this.dim("Shift+Enter")} newline · ${this.dim("Esc")} back`;
			} else if (this.hasOptions(this.currentIndex)) {
				controls = `${this.dim("↑↓")} navigate · ${this.dim("Enter")} select · ${this.dim("Tab")} next · ${this.dim("Esc")} cancel`;
			} else {
				controls = `${this.dim("Tab/Enter")} next · ${this.dim("Shift+Tab")} prev · ${this.dim("Shift+Enter")} newline · ${this.dim("Esc")} cancel`;
			}
			lines.push(padToWidth(boxLine(truncateToWidth(controls, contentWidth))));
		}

		lines.push(padToWidth(this.dim("╰" + horizontalLine(boxWidth - 2) + "╯")));
	}
}

// --- Extension ---

export default function (pi: ExtensionAPI) {
	pi.registerTool({
		name: "question",
		label: "Question",
		description:
			"Ask the user questions and let them pick from options or type answers. Use when you need user input to proceed.",
		promptSnippet: "Ask the user questions with optional multiple-choice options",
		promptGuidelines: [
			"Use question to gather user preferences, clarify ambiguous instructions, or get decisions on implementation choices.",
			"A 'Type something' free-text option is added automatically to question options; do not include 'Other' or catch-all options.",
			"If you recommend a specific option in question, put it first and add '(Recommended)' at the end of the label.",
			"Batch related questions into a single question tool call to reduce interruptions.",
		],
		parameters: QuestionParams,

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) {
				return {
					content: [{ type: "text", text: "Error: UI not available (running in non-interactive mode)" }],
					details: {
						questions: params.questions.map((q) => ({ question: q.question, answer: null })),
					} as QuestionResultDetails,
				};
			}

			if (params.questions.length === 0) {
				return {
					content: [{ type: "text", text: "Error: No questions provided" }],
					details: { questions: [] } as QuestionResultDetails,
				};
			}

			const result = await ctx.ui.custom<PerQuestionState[] | null>((tui, _theme, _kb, done) => {
				return new QnAComponent(params.questions, tui, done);
			});

			if (result === null) {
				return {
					content: [{ type: "text", text: "User cancelled" }],
					details: {
						questions: params.questions.map((q) => ({ question: q.question, answer: null })),
					} as QuestionResultDetails,
				};
			}

			const parts: string[] = [];
			const detailQuestions: QuestionResultDetails["questions"] = [];

			for (let i = 0; i < params.questions.length; i++) {
				const q = params.questions[i];
				const s = result[i];
				const answer = s.answer.trim() || "(no answer)";

				parts.push(`Q: ${q.question}`);
				parts.push(`A: ${answer}`);
				if (i < params.questions.length - 1) parts.push("");

				detailQuestions.push({
					question: q.question,
					answer: s.answer.trim() || null,
					wasCustom: s.wasCustom,
				});
			}

			return {
				content: [{ type: "text", text: `User answered:\n\n${parts.join("\n")}` }],
				details: { questions: detailQuestions } as QuestionResultDetails,
			};
		},

		renderCall(args, theme, _context) {
			const questions = Array.isArray(args.questions) ? args.questions : [];
			let text = theme.fg("toolTitle", theme.bold("question "));

			if (questions.length === 1) {
				const q = questions[0];
				text += theme.fg("muted", q.question);
				const opts = Array.isArray(q.options) ? q.options : [];
				if (opts.length) {
					const labels = [...opts.map((o: { label: string }) => o.label), "Type something."];
					text += `\n${theme.fg("dim", `  Options: ${labels.map((l: string, i: number) => `${i + 1}. ${l}`).join(", ")}`)}`;
				}
			} else {
				text += theme.fg("muted", `${questions.length} questions`);
				for (const q of questions) {
					text += `\n  ${theme.fg("text", q.question)}`;
					const opts = Array.isArray(q.options) ? q.options : [];
					if (opts.length) {
						const labels = [...opts.map((o: { label: string }) => o.label), "Type something."];
						text += `\n  ${theme.fg("dim", labels.map((l: string, i: number) => `${i + 1}. ${l}`).join(", "))}`;
					}
				}
			}

			return new Text(text, 0, 1);
		},

		renderResult(result, _options, theme, _context) {
			const details = result.details as QuestionResultDetails | undefined;
			if (!details?.questions) {
				const text = result.content[0];
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			}

			const lines: string[] = [];
			for (let i = 0; i < details.questions.length; i++) {
				const q = details.questions[i];
				if (i > 0) lines.push("");
				lines.push(theme.fg("muted", `Q: ${q.question}`));
				if (q.answer === null) {
					lines.push(theme.fg("warning", "A: (cancelled)"));
				} else {
					lines.push(theme.fg("accent", `A: ${q.answer}`));
				}
			}

			return new Text(lines.join("\n"), 0, 0);
		},
	});
}
