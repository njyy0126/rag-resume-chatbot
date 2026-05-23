import { env } from "../../config/env";
import { AppError } from "../../utils/AppError";

const CHAT_ENDPOINT = "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions";

type ChatUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type ChatResult = {
  answer: string;
  usage: ChatUsage | null;
};

export const generateQwenChatAnswer = async (
  question: string,
  contextBlocks: string[],
): Promise<ChatResult> => {
  if (!env.DASHSCOPE_API_KEY) {
    throw new AppError("Missing DASHSCOPE_API_KEY for chat generation.", 500);
  }

  const systemPrompt = [
    "You are a careful career assistant.",
    "Answer only using the provided context.",
    "If the context does not support the answer, say evidence is insufficient.",
    "Do not invent facts or citations.",
  ].join(" ");

  const contextPrompt = contextBlocks
    .map((block, index) => `Context ${index + 1}:\n${block}`)
    .join("\n\n");

  const userPrompt = `Question:\n${question}\n\nAvailable context:\n${contextPrompt}`;

  let response: Response;
  try {
    response = await fetch(CHAT_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.DASHSCOPE_API_KEY}`,
      },
      body: JSON.stringify({
        model: env.QWEN_CHAT_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.1,
      }),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown network error";
    throw new AppError(`Qwen chat network request failed: ${reason}`, 502);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new AppError(`Qwen chat request failed: ${errorText}`, 502);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: ChatUsage;
  };

  const answer = payload.choices?.[0]?.message?.content?.trim();
  if (!answer) {
    throw new AppError("Qwen chat returned an empty answer.", 502);
  }

  return {
    answer,
    usage: payload.usage ?? null,
  };
};
