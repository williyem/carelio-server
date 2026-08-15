import { env } from '../../config/env';

export type OpenRouterChatMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export async function chatCompletion(
  messages: OpenRouterChatMessage[],
  options?: { timeoutMs?: number }
): Promise<string | null> {
  const apiKey = env.OPEN_ROUTER_API_KEY?.trim();
  if (!apiKey) return null;

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options?.timeoutMs ?? 12_000
  );

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.APP_URL,
        'X-Title': 'Carelio',
      },
      body: JSON.stringify({
        model: env.OPEN_ROUTER_MODEL,
        messages,
        temperature: 0,
        max_tokens: 256,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
