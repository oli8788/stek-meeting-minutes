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
        const file = formData.get("file") as File | null;
        const chunksJson = formData.get("chunks") as string | null;
        const fileUrisJson = formData.get("fileUris") as string | null;

        let contentPayloads: any[] = [];

        if (chunksJson) {
            const chunks: { fileUri: string; mimeType: string }[] = JSON.parse(chunksJson);
            console.log(`Analyzing multimodal request with ${chunks.length} segments.`);
            contentPayloads = chunks.map(chunk => ({
                fileData: {
                    fileUri: chunk.fileUri,
                    mimeType: chunk.mimeType
                }
            }));
        } else if (fileUrisJson) {
            // Backward compatibility for old clients
            const fileUris: string[] = JSON.parse(fileUrisJson);
            console.log(`Analyzing multimodal request with ${fileUris.length} segments (legacy).`);
            contentPayloads = fileUris.map(uri => ({
                fileData: {
                    fileUri: uri,
                    mimeType: "audio/wav"
                }
            }));
        } else if (file) {
            console.log(`Analyzing direct file upload: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
            const arrayBuffer = await file.arrayBuffer();
            const base64Data = Buffer.from(arrayBuffer).toString("base64");
            contentPayloads = [{
                inlineData: {
                    data: base64Data,
                    mimeType: file.type || "audio/mpeg",
                },
            }];
        } else {
            return NextResponse.json({ error: "No file or URIs provided" }, { status: 400 });
        }

        const model = getModel();
        const prompt = `당신은 오디오 분석 전문가입니다. 다음 지침을 엄격히 준수하여 회의록을 생성하세요:

 1. **시간순 정밀 분석**: 오디오의 시작부터 끝까지 흐름을 따라가며, 논의된 순서대로 내용을 정리하세요.
 2. **내부 초안 작성 (Internal Reasoning)**: 먼저 머릿속으로 오디오의 주요 발화 내용과 타임라인을 정리한 뒤, 그 결과를 바탕으로 최종 JSON을 생성하세요.
 3. **실제 발화 데이터 우선**: STEK 브랜드 지식보다 오디오에서 실제로 언급된 숫자, 날짜, 인명, 기술적 결정을 최우선으로 기록하세요. 오디오에 없는 내용은 절대 추가하지 마세요. (No Hallucinations)
 4. **연속성 유지**: 오디오가 여러 조각으로 나뉘어 있어도 하나의 연속된 회의로 처리하세요.

 출렉 형식은 반드시 아래의 JSON 구조를 따르며, JSON 외의 텍스트는 포함하지 마세요:
 {
   "ko": {
     "title": "구체적인 회의 제목",
     "date": "YYYY-MM-DD",
     "participants": ["참석자1", "참석자2"],
     "summary": "회의 전체 흐름을 요약한 3-4문장",
     "discussion": [{"topic": "구체적 주제", "content": "논의 내용 및 결과 (상세하게)"}],
     "decisions": ["결정사항"],
     "actionItems": [{"task": "할일", "assignee": "담당자", "due": "기한"}]
   },
   "en": {
     "title": "Specific Meeting Title",
     "date": "YYYY-MM-DD",
     "participants": ["Name1", "Name2"],
     "summary": "Full overview of the meeting flow.",
     "discussion": [{"topic": "Specific Topic", "content": "Detailed context and conclusion."}],
     "decisions": ["Decisions"],
     "actionItems": [{"task": "Task", "assignee": "Assignee", "due": "Due Date"}]
   }
 }`;

        // Pass all content payloads and the prompt
        console.log("Payloads count:", contentPayloads.length);
        console.log("First payload excerpt:", JSON.stringify(contentPayloads[0]).substring(0, 200));

        const startTime = Date.now();
        const result = await model.generateContent([
            ...contentPayloads,
            prompt,
        ]);
        const endTime = Date.now();
        console.log(`Gemini API Response Time: ${(endTime - startTime) / 1000}s`);

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
        console.error("Analysis error FULL:", error);
        if (error.response) console.error("API Response Error:", JSON.stringify(error.response));

        return NextResponse.json(
            {
                error: error.message || "Failed to analyze audio",
                details: error.name || "UnknownError"
            },
            { status: 500 }
        );
    }
}
