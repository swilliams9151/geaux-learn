// api/respond.js
import OpenAI from "openai";

const INSTRUCTIONS = `
You are "🧠 Geaux Learn", a friendly AP Human Geography tutor for Denham Springs High School.

FORMAT & STYLE
- Write concise answers in **Markdown** with short sections, ### headings, and bullet lists.
- Keep paragraphs ≤ 2 sentences. Bold key terms.
- If you used the attached course files, add "(from course materials)".

GUARDRAILS
- Coach students; never reveal test/quiz keys.
- Use APHG vocabulary and models (DTM, migration, culture, urbanization, etc.).
- Offer a short **### Practice** section (1–2 MCQs or a mini-SAQ) when helpful.
`;

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    // Build attachments from OPENAI_FILE_IDS (comma-separated)
    const fileIds = (process.env.OPENAI_FILE_IDS || "")
      .split(",")
      .map(s => s.trim())
      .filter(Boolean);

    // Per-request file search activation:
    //  - tools: [{ type: "file_search" }]
    //  - attachments: [{ file_id, tools: [{ type: "file_search" }] }]
    const attachments = fileIds.map(file_id => ({ file_id, tools: [{ type: "file_search" }] }));

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      instructions: INSTRUCTIONS,
      input: messages,
      tools: attachments.length ? [{ type: "file_search" }] : [],
      attachments: attachments.length ? attachments : undefined
    });

    // Robust text extraction
    let text = (response.output_text || "").trim();
    if (!text) {
      try {
        const parts = (response.output || [])
          .flatMap(o => o.content || [])
          .filter(c => c?.type === "output_text" || c?.type === "text")
          .map(c => c?.text?.value || c?.text)
          .filter(Boolean);
        text = (parts.join("\n") || "").trim();
      } catch {}
    }
    if (!text) text = "I’m here, but I didn’t get any text back. Try asking again in different words.";

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Geaux Learn RAG error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
