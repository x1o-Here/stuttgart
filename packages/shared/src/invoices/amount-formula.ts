import { roundMoney } from "./money.js";

/**
 * Row amount formulas for client invoice templates.
 *
 * A formula refers to template columns by key in braces, e.g.
 * `{quantity} * {rate} - {custom_discount_x}`, and supports numbers,
 * `+ - * /`, unary minus and parentheses. It is parsed into a small tree and
 * evaluated directly; nothing is ever passed to `eval`.
 */

export const DEFAULT_AMOUNT_FORMULA = "{quantity} * {rate}";

export type FormulaNode =
  | { kind: "number"; value: number }
  | { kind: "ref"; key: string }
  | { kind: "neg"; operand: FormulaNode }
  | { kind: "binary"; op: "+" | "-" | "*" | "/"; left: FormulaNode; right: FormulaNode };

export type ParsedFormula =
  | { ok: true; ast: FormulaNode; refs: string[] }
  | { ok: false; error: string };

type Token =
  | { type: "number"; value: number; pos: number }
  | { type: "ref"; key: string; pos: number }
  | { type: "op"; value: "+" | "-" | "*" | "/"; pos: number }
  | { type: "paren"; value: "(" | ")"; pos: number };

class FormulaError extends Error {}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const ch = input[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }
    if (/[0-9.]/.test(ch)) {
      const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(input.slice(i));
      if (!match) throw new FormulaError(`Invalid number at position ${i + 1}.`);
      tokens.push({ type: "number", value: Number(match[0]), pos: i });
      i += match[0].length;
      continue;
    }
    if (ch === "{") {
      const end = input.indexOf("}", i);
      if (end < 0) throw new FormulaError("A column reference is missing its closing brace.");
      const key = input.slice(i + 1, end).trim();
      if (!key) throw new FormulaError("Empty column reference.");
      tokens.push({ type: "ref", key, pos: i });
      i = end + 1;
      continue;
    }
    if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
      tokens.push({ type: "op", value: ch, pos: i });
      i++;
      continue;
    }
    if (ch === "(" || ch === ")") {
      tokens.push({ type: "paren", value: ch, pos: i });
      i++;
      continue;
    }
    throw new FormulaError(`Unexpected "${ch}" at position ${i + 1}.`);
  }
  return tokens;
}

function parseTokens(tokens: Token[]): FormulaNode {
  let index = 0;
  const peek = () => tokens[index];

  function expression(): FormulaNode {
    let node = term();
    for (let t = peek(); t?.type === "op" && (t.value === "+" || t.value === "-"); t = peek()) {
      index++;
      node = { kind: "binary", op: t.value, left: node, right: term() };
    }
    return node;
  }

  function term(): FormulaNode {
    let node = unary();
    for (let t = peek(); t?.type === "op" && (t.value === "*" || t.value === "/"); t = peek()) {
      index++;
      node = { kind: "binary", op: t.value, left: node, right: unary() };
    }
    return node;
  }

  function unary(): FormulaNode {
    const t = peek();
    if (t?.type === "op" && (t.value === "-" || t.value === "+")) {
      index++;
      const operand = unary();
      return t.value === "-" ? { kind: "neg", operand } : operand;
    }
    return primary();
  }

  function primary(): FormulaNode {
    const t = peek();
    if (!t) throw new FormulaError("The formula ends unexpectedly.");
    index++;
    if (t.type === "number") return { kind: "number", value: t.value };
    if (t.type === "ref") return { kind: "ref", key: t.key };
    if (t.type === "paren" && t.value === "(") {
      const node = expression();
      const close = peek();
      if (close?.type !== "paren" || close.value !== ")") {
        throw new FormulaError("A bracket is not closed.");
      }
      index++;
      return node;
    }
    throw new FormulaError(`Unexpected "${t.type === "op" || t.type === "paren" ? t.value : ""}" at position ${t.pos + 1}.`);
  }

  if (tokens.length === 0) throw new FormulaError("Enter a formula.");
  const ast = expression();
  if (index < tokens.length) {
    const t = tokens[index];
    throw new FormulaError(`Unexpected ${t.type === "paren" ? `"${t.value}"` : "value"} at position ${t.pos + 1}.`);
  }
  return ast;
}

function collectRefs(node: FormulaNode, into: Set<string>) {
  switch (node.kind) {
    case "ref":
      into.add(node.key);
      break;
    case "neg":
      collectRefs(node.operand, into);
      break;
    case "binary":
      collectRefs(node.left, into);
      collectRefs(node.right, into);
      break;
  }
}

/**
 * Parses a stored (`{key}`) formula. When `allowedKeys` is given, every
 * column reference must be one of them.
 */
export function parseAmountFormula(formula: string, allowedKeys?: Iterable<string>): ParsedFormula {
  try {
    const ast = parseTokens(tokenize(formula));
    const refs = new Set<string>();
    collectRefs(ast, refs);
    if (allowedKeys) {
      const allowed = new Set(allowedKeys);
      const unknown = [...refs].find((key) => !allowed.has(key));
      if (unknown) return { ok: false, error: `Unknown or non-numeric column "${unknown}".` };
    }
    return { ok: true, ast, refs: [...refs] };
  } catch (error) {
    if (error instanceof FormulaError) return { ok: false, error: error.message };
    throw error;
  }
}

function evaluateNode(node: FormulaNode, values: Record<string, number>): number {
  switch (node.kind) {
    case "number":
      return node.value;
    case "ref": {
      const value = values[node.key];
      return Number.isFinite(value) ? value : 0;
    }
    case "neg":
      return -evaluateNode(node.operand, values);
    case "binary": {
      const left = evaluateNode(node.left, values);
      const right = evaluateNode(node.right, values);
      switch (node.op) {
        case "+":
          return left + right;
        case "-":
          return left - right;
        case "*":
          return left * right;
        case "/":
          return right === 0 ? 0 : left / right;
      }
    }
  }
}

/** Evaluates a parsed formula; missing values count as 0, result rounded to cents. */
export function evaluateAmountFormula(ast: FormulaNode, values: Record<string, number>): number {
  return roundMoney(evaluateNode(ast, values));
}
