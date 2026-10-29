// =====================================================================
// 태스크 2: Gemini AI 교사 피드백 모듈
// 학생의 문제·설계를 바탕으로 격려와 힌트를 주는 "AI 교사" 피드백을 요청한다.
// 보안 주의: 클라이언트에서 API 키를 직접 쓰면 키가 노출된다. 수업용 프로토타입
//          수준이며, 실제 배포 시에는 태스크 3의 Firebase Functions 등
//          백엔드 프록시로 키를 숨기는 것을 권장한다. (review-report.md 참고)
// =====================================================================

const GEMINI_SYSTEM_PROMPT = `너는 중학교 1학년 학생을 돕는 친절한 '무순 관리 에이전트' 설계 AI 교사야.
학생은 무순을 기르며 겪은 문제를 마이크로비트로 해결하려고 설계 중이야.
규칙:
- 아주 쉬운 말로, 따뜻하고 격려하는 말투로 짧게(5~7문장) 답해.
- 먼저 칭찬 1가지, 그다음 더 생각해볼 질문 1~2가지를 줘.
- 정답(완성된 코드나 전체 해결책)을 대신 알려주지 마. 스스로 생각하도록 힌트만 줘.
- 학생이 고른 센서/부품이 문제 해결에 맞는지 부드럽게 짚어줘.
- 전문 용어는 풀어서 설명해.`;

/**
 * Gemini에 AI 교사 피드백을 요청한다.
 * @returns {Promise<string>} 피드백 텍스트
 * @throws {Error} code: NO_KEY | API_ERROR:<status> | EMPTY | NETWORK
 */
async function getTeacherFeedback({ apiKey, model, problem, steps, sensors }) {
  if (!apiKey) throw new Error("NO_KEY");
  const useModel = model || "gemini-2.0-flash";
  const endpoint =
    `https://generativelanguage.googleapis.com/v1beta/models/${useModel}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const stepsText = steps.length
    ? steps.map((s, i) => `${i + 1}) 조건: ${s.condition} → 동작: ${s.action}`).join("\n")
    : "(아직 없음)";
  const userText =
    `학생이 고른 문제: ${problem || "(선택 안 됨)"}\n` +
    `설계(조건 → 동작):\n${stepsText}\n` +
    `사용할 센서/부품: ${sensors && sensors.length ? sensors.join(", ") : "(선택 안 됨)"}\n\n` +
    `위 설계에 대해 AI 교사로서 피드백을 해 줘.`;

  const body = {
    systemInstruction: { parts: [{ text: GEMINI_SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: userText }] }],
    generationConfig: { temperature: 0.7, maxOutputTokens: 500 },
  };

  let res;
  try {
    res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error("NETWORK");
  }

  if (!res.ok) {
    throw new Error(`API_ERROR:${res.status}`);
  }

  const data = await res.json();
  const text = (data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts || [])
    .map((p) => p.text || "")
    .join("")
    .trim();

  if (!text) throw new Error("EMPTY");
  return text;
}

window.getTeacherFeedback = getTeacherFeedback;
