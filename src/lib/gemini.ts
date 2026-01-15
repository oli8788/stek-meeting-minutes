import { GoogleGenerativeAI } from "@google/generative-ai";

export function getModel() {
  // DIAGNOSTIC: Log all available keys (privacy safe)
  const allKeys = Object.keys(process.env);
  console.log("Available Process Env Keys:", allKeys.filter(k => k.startsWith("GEMINI") || k.includes("API") || k.includes("VERCEL")));

  const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

  if (!apiKey) {
    console.error("FATAL: GEMINI_API_KEY is missing. Keys found:", allKeys.filter(k => k.includes("API")));
    throw new Error("GEMINI_API_KEY is not set in the environment.");
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  return genAI.getGenerativeModel({
    model: "gemini-flash-latest",
    systemInstruction: `당신은 전문 회의록 속기사(Stenographer)입니다. 
 제공된 오디오 데이터를 있는 그대로 경청하고, 발화된 내용을 시계열 순서로 정확하게 정리하세요.

 **[운영 원칙]**
 1. **중립성 유지**: 배경 지식이나 상상력을 동원하지 말고, 오디오에서 실제로 들리는 대화와 데이터만 기록하세요.
 2. **브랜드 명칭 보정**: STEK 브랜드와 관련된 제품명(DYNO시리즈, NEX시리즈 등)이 들릴 경우에만 정확한 철자로 교정하세요. 그 외의 내용은 일체 가공하지 마세요.
 3. **무음 처리**: 내용이 전혀 없거나 소음만 있다면 반드시 "내용 없음"으로 응답하세요.

 **[출력 언어 및 형식]**
 - 한국어(ko)와 영어(en) 버전을 생성합니다.
 - 반드시 아래의 **JSON 형식**으로만 응답하세요.

  \`\`\`json
  {
    "ko": {
      "title": "회의 핵심 내용 요약 제목",
      "date": "YYYY-MM-DD (없으면 N/A)",
      "participants": ["참석자 목록"],
      "summary": "핵심 요약 (사실 기반)",
      "discussion": [
        { "topic": "논의 주제", "content": "오디오에서 언급된 세부 내용" }
      ],
      "decisions": ["합의된 사항"],
      "actionItems": [
        { "task": "할 일", "assignee": "담당자", "due": "기한" }
      ]
    },
    "en": {
      "title": "Meeting Title",
      "date": "Date",
      "participants": ["Names"],
      "summary": "Accurate summary of audio content.",
      "discussion": [
        { "topic": "Topic", "content": "Verbatim-based details from the audio stream." }
      ],
      "decisions": ["Decisions"],
      "actionItems": [
        { "task": "Task", "assignee": "Person", "due": "Deadline" }
      ]
    }
  }
  \`\`\``,
    generationConfig: { responseMimeType: "application/json" }
  });
}
