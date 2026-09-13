/**
 * AI の提供元（Claude / OpenAI）を切り替える層。
 *
 * 環境変数 AI_PROVIDER で選ぶ。既定は anthropic（仕様書 第18章のチーム決定）。
 * どちらの提供元でも、呼び出し側は「zod スキーマを渡すと、その形の JSON が返る」
 * という同じ形で使える。プロンプトは呼び出し側（server/ai/<task>.ts）が持つ。
 */
import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type { z } from 'zod';

export type AiProviderName = 'anthropic' | 'openai';

/** 既定のモデル。環境変数で上書きできる */
const DEFAULT_MODELS: Record<AiProviderName, string> = {
  anthropic: 'claude-opus-5',
  openai: 'gpt-5.6-terra',
};

const MAX_TOKENS = 16000;

export class AiConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiConfigError';
  }
}

export class AiOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AiOutputError';
  }
}

export type GenerateJsonParams<T> = {
  /** 出力の形。この形で返らなければ AiOutputError */
  schema: z.ZodType<T>;
  /** スキーマの名前。OpenAI が必須で求める */
  schemaName: string;
  /** 役割や制約を書く。仕様書 第14.1節の「守ること」はここに書く */
  system: string;
  /** 今回の入力 */
  user: string;
};

export interface LlmClient {
  readonly provider: AiProviderName;
  readonly model: string;
  generateJson<T>(params: GenerateJsonParams<T>): Promise<T>;
}

/** 環境変数から提供元を読む。未設定・知らない値のときは anthropic */
export function getAiProviderName(): AiProviderName {
  const raw = process.env.AI_PROVIDER?.trim().toLowerCase();
  return raw === 'openai' ? 'openai' : 'anthropic';
}

function getModel(provider: AiProviderName): string {
  const fromEnv =
    provider === 'anthropic' ? process.env.ANTHROPIC_MODEL : process.env.OPENAI_MODEL;
  return fromEnv?.trim() || DEFAULT_MODELS[provider];
}

function requireKey(name: string): string {
  const key = process.env[name]?.trim();
  if (!key) {
    throw new AiConfigError(
      `${name} が設定されていません。next dev は .env.local、wrangler dev と本番は .dev.vars / wrangler secret put に入れてください`,
    );
  }
  return key;
}

/** Claude（Anthropic）。structured outputs で JSON を受け取る */
class AnthropicClient implements LlmClient {
  readonly provider = 'anthropic' as const;
  readonly model: string;
  private readonly client: Anthropic;

  constructor() {
    this.model = getModel('anthropic');
    this.client = new Anthropic({ apiKey: requireKey('ANTHROPIC_API_KEY') });
  }

  async generateJson<T>({ schema, system, user }: GenerateJsonParams<T>): Promise<T> {
    const response = await this.client.messages.parse({
      model: this.model,
      max_tokens: MAX_TOKENS,
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { format: zodOutputFormat(schema) },
    });

    if (response.stop_reason === 'refusal') {
      throw new AiOutputError('Claude が応答を断りました');
    }
    if (response.parsed_output == null) {
      throw new AiOutputError('Claude の出力を指定の形に読み取れませんでした');
    }
    return response.parsed_output as T;
  }
}

/** OpenAI。Responses API の structured outputs で JSON を受け取る */
class OpenAiClient implements LlmClient {
  readonly provider = 'openai' as const;
  readonly model: string;
  private readonly client: OpenAI;

  constructor() {
    this.model = getModel('openai');
    this.client = new OpenAI({ apiKey: requireKey('OPENAI_API_KEY') });
  }

  async generateJson<T>({
    schema,
    schemaName,
    system,
    user,
  }: GenerateJsonParams<T>): Promise<T> {
    let format: ReturnType<typeof zodTextFormat>;
    try { format = zodTextFormat(schema, schemaName); }
    catch (error) {
      throw new AiConfigError(`OpenAI形式変換エラー（${error instanceof Error ? error.name : 'unknown'}）`);
    }
    const response = await this.client.responses.parse({
      model: this.model,
      input: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      text: { format },
    }).catch((error: unknown) => {
      if (error instanceof OpenAI.APIError) {
        // Never return the provider's message: auth errors may quote part of a key.
        const code = typeof error.code === 'string' && /^[a-zA-Z0-9_]+$/.test(error.code) ? error.code : 'unknown';
        throw new AiConfigError(`OpenAI API エラー（status: ${error.status ?? 'unknown'}, code: ${code}）`);
      }
      throw new AiConfigError(`OpenAI接続エラー（${error instanceof Error ? error.name : 'unknown'}）`);
    });

    if (response.output_parsed == null) {
      throw new AiOutputError('OpenAI の出力を指定の形に読み取れませんでした');
    }
    return response.output_parsed as T;
  }
}

/**
 * 提供元のクライアントを作る。
 * キーが無いときは AiConfigError を投げる。モックのときは呼ばれない。
 */
export function createLlmClient(provider: AiProviderName = getAiProviderName()): LlmClient {
  return provider === 'openai' ? new OpenAiClient() : new AnthropicClient();
}
