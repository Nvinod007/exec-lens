import { NextResponse } from "next/server";

import { parseSyntaxError, validateJavaScript } from "@/lib/validate-snippet";

export const runtime = "nodejs";

interface ValidateRequestBody {
  code?: string;
  language?: "javascript" | "typescript";
}

/** POST /api/validate — fast syntax check with line/column for editor lint. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ValidateRequestBody;
    const code = body.code ?? "";
    const language = body.language ?? "javascript";

    if (!code.trim()) {
      return NextResponse.json({ ok: true });
    }

    if (language === "javascript") {
      const issue = validateJavaScript(code);
      if (issue) {
        return NextResponse.json({
          ok: false,
          line: issue.line,
          column: issue.column,
          message: issue.message,
        });
      }
      return NextResponse.json({ ok: true });
    }

    const esbuild = await import("esbuild");
    try {
      await esbuild.transform(code, {
        loader: "ts",
        target: "es2020",
        format: "cjs",
      });
      return NextResponse.json({ ok: true });
    } catch (error) {
      const issue = parseSyntaxError(error);
      if (issue) {
        return NextResponse.json({
          ok: false,
          line: issue.line,
          column: issue.column,
          message: issue.message,
        });
      }
      return NextResponse.json({
        ok: false,
        line: 1,
        column: 0,
        message: error instanceof Error ? error.message : "Invalid TypeScript",
      });
    }
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        line: 1,
        column: 0,
        message: error instanceof Error ? error.message : "Validation failed",
      },
      { status: 500 },
    );
  }
}
