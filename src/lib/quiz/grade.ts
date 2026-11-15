import { create, all, type MathNode } from "mathjs";
import type { AnswerType, Feedback, GivenAnswer, PublicQuestion, SecretAnswer, StepAnswer } from "./types";

const math = create(all, {});

// ------------------------------------------------------------------ normalization

/** Case-, accent-, space- and punctuation-insensitive text. */
export function normalizeText(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\s*[.!?;:,]+$/g, "");
}

const SUPERSCRIPTS: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };

/** Turn what a student types (or a LaTeX-ish answer) into mathjs syntax. */
export function normalizeMath(s: string) {
  let t = s.trim();
  t = t.replace(/^\$+|\$+$/g, "");
  t = t.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => "^" + [...m].map((c) => SUPERSCRIPTS[c]).join(""));
  t = t
    .replace(/[−–]/g, "-")
    .replace(/[×·⋅]/g, "*")
    .replace(/÷/g, "/")
    .replace(/√/g, "sqrt")
    .replace(/π/g, "pi")
    .replace(/\\cdot|\\times/g, "*")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1)/($2)")
    .replace(/\\sqrt\{([^{}]*)\}/g, "sqrt($1)")
    .replace(/\\left|\\right/g, "")
    .replace(/[{}]/g, (c) => (c === "{" ? "(" : ")"))
    .replace(/\\pi/g, "pi");
  // French decimal comma: 0,5 → 0.5 (only between digits)
  t = t.replace(/(\d),(\d)/g, "$1.$2");
  return t;
}

// Only plain arithmetic is allowed — never evaluate arbitrary mathjs (functions, assignment, imports...).
const ALLOWED_FUNCTIONS = new Set(["sqrt", "abs", "exp", "log", "ln", "sin", "cos", "tan"]);
const ALLOWED_CONSTANTS = new Set(["pi", "e", "i"]);

function safeParse(src: string, variables: string[]): MathNode | null {
  if (src.length > 200) return null;
  let node: MathNode;
  try {
    node = math.parse(src.replace(/\bln\(/g, "log("));
  } catch {
    return null;
  }
  const vars = new Set(variables);
  let ok = true;
  node.traverse((n: MathNode, _path: string, parent: MathNode | null) => {
    switch (n.type) {
      case "ConstantNode":
      case "OperatorNode":
      case "ParenthesisNode":
        break;
      case "SymbolNode": {
        const name = (n as unknown as { name: string }).name;
        const isFn = parent?.type === "FunctionNode" && (parent as unknown as { fn: MathNode }).fn === n;
        if (isFn ? !ALLOWED_FUNCTIONS.has(name) : !(vars.has(name) || ALLOWED_CONSTANTS.has(name))) ok = false;
        break;
      }
      case "FunctionNode":
        break; // name checked through its SymbolNode child
      default:
        ok = false;
    }
  });
  return ok ? node : null;
}

function evalNode(node: MathNode, scope: Record<string, number>): number | null {
  try {
    const v = node.compile().evaluate(scope);
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (v && typeof v === "object" && "re" in v && Math.abs((v as { im: number }).im) < 1e-12) return (v as { re: number }).re;
    return null;
  } catch {
    return null;
  }
}

function close(a: number, b: number) {
  return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
}

export function parseNumber(s: string): number | null {
  const node = safeParse(normalizeMath(s), []);
  return node ? evalNode(node, {}) : null;
}

/** Algebraic equivalence by evaluation at several random points. */
export function equivalentExpressions(given: string, expected: string, variables: string[]): boolean {
  // the course writes polynomials in X; accept both cases
  const vars = [...new Set(variables.flatMap((v) => [v, v.toLowerCase(), v.toUpperCase()]))];
  const g = safeParse(normalizeMath(given), vars);
  const e = safeParse(normalizeMath(expected), vars);
  if (!g || !e) return false;
  const points = [0.37, -1.21, 2.5, 3.14, -0.73, 1.9, -2.6, 0.11];
  let compared = 0;
  for (let k = 0; k < points.length; k++) {
    const scope: Record<string, number> = {};
    variables.forEach((v, j) => {
      const x = points[(k + j * 3) % points.length] + j * 0.17;
      scope[v] = x;
      scope[v.toLowerCase()] = x;
      scope[v.toUpperCase()] = x;
    });
    const a = evalNode(g, scope);
    const b = evalNode(e, scope);
    if (a === null && b === null) continue;
    if (a === null || b === null || !close(a, b)) return false;
    compared++;
  }
  return compared >= 3;
}

export function matchesAccepted(type: AnswerType, given: string, accepted: string[], variables: string[] = []): boolean {
  if (!given.trim()) return false;
  if (type === "text") {
    const g = normalizeText(given);
    return accepted.some((a) => normalizeText(a) === g);
  }
  if (type === "number") {
    const g = parseNumber(given);
    if (g === null) return false;
    return accepted.some((a) => {
      const v = parseNumber(a);
      return v !== null && close(g, v);
    });
  }
  // expression
  const vars = variables.length ? variables : ["x"];
  return accepted.some((a) => equivalentExpressions(given, a, vars));
}

// ------------------------------------------------------------------ grading

function optionMd(q: PublicQuestion | Extract<PublicQuestion, { kind: "steps" }>["steps"][number], id: string) {
  if ("options" in q) return q.options.find((o) => o.id === id)?.md;
  return undefined;
}

export function gradeQuestion(publicQ: PublicQuestion, answer: SecretAnswer, given: GivenAnswer, explanation: string): Feedback {
  switch (answer.kind) {
    case "mcq": {
      const correct = "option" in given && given.option === answer.option;
      return { correct, explanation, correctOption: answer.option, correctAnswer: optionMd(publicQ, answer.option) };
    }
    case "true_false": {
      const correct = "value" in given && given.value === answer.value;
      return { correct, explanation, correctValue: answer.value, correctAnswer: answer.value ? "Vrai" : "Faux" };
    }
    case "fill_blank": {
      const text = "text" in given ? String(given.text) : "";
      const correct = matchesAccepted(answer.answerType, text, answer.accepted, answer.variables);
      return { correct, explanation, correctAnswer: formatAccepted(answer.answerType, answer.accepted[0]) };
    }
    case "matching": {
      const map = "map" in given && Array.isArray(given.map) ? given.map : [];
      const correct = map.length === answer.map.length && answer.map.every((v, i) => map[i] === v);
      return { correct, explanation, correctMap: answer.map };
    }
    case "ordering": {
      const order = "order" in given && Array.isArray(given.order) ? given.order : [];
      const correct = order.length === answer.order.length && answer.order.every((v, i) => order[i] === v);
      return { correct, explanation, correctOrder: answer.order };
    }
    case "steps":
      // steps are graded one at a time with gradeStep; a whole-question grade is not meaningful
      return { correct: false, explanation };
  }
}

export function gradeStep(publicQ: Extract<PublicQuestion, { kind: "steps" }>, answer: Extract<SecretAnswer, { kind: "steps" }>, index: number, given: GivenAnswer): Feedback {
  const step: StepAnswer | undefined = answer.steps[index];
  const explanation = answer.explanations[index] ?? "";
  if (!step) return { correct: false, explanation: "Étape inconnue." };
  if (step.kind === "mcq") {
    const correct = "option" in given && given.option === step.option;
    return { correct, explanation, correctOption: step.option, correctAnswer: optionMd(publicQ.steps[index], step.option) };
  }
  const text = "text" in given ? String(given.text) : "";
  return {
    correct: matchesAccepted(step.answerType, text, step.accepted, step.variables),
    explanation,
    correctAnswer: formatAccepted(step.answerType, step.accepted[0]),
  };
}

function formatAccepted(type: AnswerType, a: string | undefined) {
  if (!a) return undefined;
  if (type === "text") return a;
  // show math answers with KaTeX: mathjs → TeX
  try {
    return "$" + math.parse(normalizeMath(a)).toTex({ parenthesis: "auto", implicit: "hide" }) + "$";
  } catch {
    return a;
  }
}
