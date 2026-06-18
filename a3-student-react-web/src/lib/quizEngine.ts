export type QuizQuestionType = "single" | "multiple" | "short";

export type QuizQuestionOption = {
  key: string;
  value: string;
};

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  answer: string[];
  explanation: string;
  questionType: QuizQuestionType;
  knowledgeTag?: string;
  difficultyLevel?: number;
  qualityScore?: number | null;
};

export type QuizPaper = {
  title?: string;
  questions: QuizQuestion[];
};

export type QuizScoreItem = {
  questionId: string;
  correct: boolean;
  userAnswer: string[];
  correctAnswer: string[];
  knowledgeTag?: string;
  questionType: QuizQuestionType;
};

export type QuizScoreSummary = {
  total: number;
  correct: number;
  percent: number;
  wrongQuestions: QuizScoreItem[];
  weakKnowledgeTags: string[];
};

export function normalizeOptionKey(option: string) {
  const matched = option.match(/^\s*([A-Z])[\.\u3001:\s-]/i);
  return matched ? matched[1].toUpperCase() : option.trim().toUpperCase();
}

export function normalizeAnswerList(answer: unknown) {
  if (Array.isArray(answer)) {
    return answer.map((item) => String(item).trim()).filter(Boolean);
  }
  if (typeof answer === "string") {
    return answer
      .split(/[,，、\s/]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function normalizeQuestionType(rawType: unknown, optionCount: number, answerCount: number): QuizQuestionType {
  if (typeof rawType === "number") {
    if (rawType === 3) return "short";
    if (rawType === 2) return "multiple";
    if (rawType === 1) return "single";
  }
  const value = String(rawType ?? "").toLowerCase();
  if (value.includes("short") || value.includes("简答")) return "short";
  if (value.includes("multi") || value.includes("multiple") || answerCount > 1) return "multiple";
  if (value.includes("single") || value.includes("单选") || optionCount > 0) return "single";
  return "short";
}

export function parseQuizQuestion(raw: unknown, index: number): QuizQuestion | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const options = Array.isArray(item.options)
    ? item.options.map((entry) => String(entry))
    : Array.isArray(item.question_options)
      ? item.question_options.map((entry) => {
          if (entry && typeof entry === "object") {
            const option = entry as Record<string, unknown>;
            return `${String(option.key ?? "")}${option.value ? `. ${String(option.value)}` : ""}`.trim();
          }
          return String(entry);
        })
      : [];
  const answers = normalizeAnswerList(item.answer ?? item.correct_answer);
  const questionText = String(item.question ?? item.question_content ?? item.prompt ?? `第 ${index + 1} 题`);
  return {
    id: String(item.id ?? item.question_id ?? `quiz-${index + 1}`),
    question: questionText,
    options,
    answer: answers,
    explanation: String(item.explanation ?? item.answer_analysis ?? ""),
    questionType: normalizeQuestionType(item.question_type, options.length, answers.length),
    knowledgeTag: item.knowledge_tag ? String(item.knowledge_tag) : item.knowledge_point ? String(item.knowledge_point) : undefined,
    difficultyLevel: typeof item.difficulty_level === "number" ? item.difficulty_level : undefined,
    qualityScore: typeof item.quality_score === "number" ? item.quality_score : null,
  };
}

export function parseQuizPaper(raw: string): QuizPaper | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    const parsed = JSON.parse(trimmed) as { title?: unknown; questions?: unknown[] } | unknown[];
    const items = Array.isArray(parsed) ? parsed : Array.isArray(parsed.questions) ? parsed.questions : [];
    const questions = items
      .map((item, index) => parseQuizQuestion(item, index))
      .filter((item): item is QuizQuestion => Boolean(item && item.question));
    return {
      title: !Array.isArray(parsed) && parsed.title ? String(parsed.title) : undefined,
      questions,
    };
  } catch {
    return null;
  }
}

export function scoreQuiz(questions: QuizQuestion[], answers: Record<string, string | string[]>) {
  const scored = questions.map((question) => {
    const userAnswer = Array.isArray(answers[question.id])
      ? (answers[question.id] as string[])
      : normalizeAnswerList(answers[question.id] ?? "");
    const correctAnswer = question.answer;
    const normalizedUser = [...userAnswer].map((item) => normalizeOptionKey(item)).sort().join("|");
    const normalizedCorrect = [...correctAnswer].map((item) => normalizeOptionKey(item)).sort().join("|");
    const correct = question.questionType === "short" ? Boolean(String(answers[question.id] ?? "").trim()) : normalizedUser === normalizedCorrect;
    return {
      questionId: question.id,
      correct,
      userAnswer,
      correctAnswer,
      knowledgeTag: question.knowledgeTag,
      questionType: question.questionType,
    } satisfies QuizScoreItem;
  });

  const wrongQuestions = scored.filter((item) => !item.correct);
  const weakKnowledgeTags = Array.from(
    new Set(
      wrongQuestions
        .map((item) => item.knowledgeTag)
        .filter((tag): tag is string => Boolean(tag))
        .slice(0, 8),
    ),
  );

  const correct = scored.length - wrongQuestions.length;
  const total = scored.length;
  return {
    total,
    correct,
    percent: total ? Math.round((correct / total) * 100) : 0,
    wrongQuestions,
    weakKnowledgeTags,
  } satisfies QuizScoreSummary;
}
