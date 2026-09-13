/**
 * AI-01〜06 の Route Handler。
 * 環境変数 AI_MODE で mock / real を切り替える（第10.2節）。
 * Node.js ランタイムを使う。runtime = 'edge' は書かない。
 */
import { NextResponse } from 'next/server';
import { NotImplementedError, getAiMode, runAiTask } from '@/server/ai';
import { AI_TASKS, isAiTask } from '@/server/ai/schemas';
import { validateAiOutput } from '@/server/ai/validate';

type RouteContext = { params: Promise<{ task: string }> };

async function handle(request: Request, context: RouteContext) {
  const { task } = await context.params;

  if (!isAiTask(task)) {
    return NextResponse.json(
      { error: 'unknown_task', message: `知らない task です: ${task}`, known: AI_TASKS },
      { status: 404 },
    );
  }

  let input: unknown = null;
  if (request.method === 'POST') {
    try {
      input = await request.json();
    } catch {
      input = null;
    }
  }

  const mode = getAiMode();

  let raw: unknown;
  try {
    raw = await runAiTask(task, input, mode);
  } catch (error) {
    if (error instanceof NotImplementedError) {
      return NextResponse.json(
        { error: 'not_implemented', message: error.message, task, mode },
        { status: 501 },
      );
    }
    return NextResponse.json(
      { error: 'ai_failed', message: 'AIの呼び出しに失敗しました', task, mode },
      { status: 502 },
    );
  }

  const result = validateAiOutput(task, raw);
  if (!result.ok) {
    return NextResponse.json(
      { error: 'invalid_output', message: 'AIの出力が形式に合いません', task, issues: result.issues },
      { status: 502 },
    );
  }

  return NextResponse.json({ task, mode, isMock: mode === 'mock', data: result.data });
}

export async function GET(request: Request, context: RouteContext) {
  return handle(request, context);
}

export async function POST(request: Request, context: RouteContext) {
  return handle(request, context);
}
