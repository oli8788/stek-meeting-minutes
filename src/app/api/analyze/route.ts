import { NextRequest, NextResponse } from "next/server";
import { getModel } from "@/lib/gemini";

export const maxDuration = 60; // 1 minute
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "GEMINI_API_KEY is not configured on the server." }, { status: 500 });
    }

    try {
        const formData = await req.formData();
        const file = formData.get("file") as File;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        console.log(`Analyzing audio: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

        const arrayBuffer = await file.arrayBuffer();
        const base64Data = Buffer.from(arrayBuffer).toString("base64");

        const model = getModel();
        const prompt = `Analyze this audio and generate a high-quality meeting minutes report in both Korean and English.
The output MUST be a valid JSON object strictly following this structure:
{
  "ko": {
    "title": "회의 제목",
    "date": "YYYY-MM-DD",
    "participants": ["이름1", "이름2"],
    "summary": "전체 요약",
    "discussion": [{"topic": "주제", "content": "내용"}],
    "decisions": ["결정사항1"],
    "actionItems": [{"task": "할일", "assignee": "담당자", "due": "기한"}]
  },
  "en": {
    "title": "Meeting Title",
    "date": "YYYY-MM-DD",
    "participants": ["Name1", "Name2"],
    "summary": "Executive summary",
    "discussion": [{"topic": "Topic", "content": "Content"}],
    "decisions": ["Decision1"],
    "actionItems": [{"task": "Task", "assignee": "Assignee", "due": "Due Date"}]
  }
}

Do not include any text other than the JSON object.`;

        const result = await model.generateContent([
            {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type || "audio/mpeg",
                },
            },
            prompt,
        ]);

        const response = await result.response;
        const text = response.text().trim();
        const cleanText = text.replace(/^```json\n?/, "").replace(/\n?```$/, "");

        try {
            const jsonResult = JSON.parse(cleanText);
            return NextResponse.json(jsonResult);
        } catch (e) {
            console.error("JSON parsing error:", e);
            return NextResponse.json({
                error: "Failed to parse structured output",
                rawText: text
            }, { status: 500 });
        }
    } catch (error: any) {
        console.error("Analysis error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to analyze audio" },
            { status: 500 }
        );
    }
}
