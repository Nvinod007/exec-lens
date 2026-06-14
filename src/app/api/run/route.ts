import { NextResponse } from "next/server";

import { runSnippet } from "@/lib/runner";

export const runtime = "nodejs";

interface RunRequestBody {
  code?: string;
  language?: "javascript" | "typescript";
}

/** POST /api/run — execute a snippet and return recorded execution steps. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RunRequestBody;
    const code = body.code?.trim();
    const language = body.language ?? "javascript";

    if (!code) {
      return NextResponse.json({ error: "Code is required." }, { status: 400 });
    }

    if (code.length > 20_000) {
      return NextResponse.json(
        { error: "Snippet exceeds the 20,000 character limit." },
        { status: 400 },
      );
    }

    const result = await runSnippet(code, { language });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to run snippet.",
      },
      { status: 500 },
    );
  }
}
