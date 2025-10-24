// api/respond.js
const INSTRUCTIONS = `
You are "🧠 Geaux Learn", a friendly AP Human Geography tutor for Denham Springs High School.

STYLE
- Keep answers concise (aim ~120–180 words unless asked for more).
- Use **Markdown** with short sections and clear spacing:
  - Start with a one-line summary.
  - Use \`###\` headings for sections.
  - Use bullet points (3–5 items max).
  - Put a blank line between sections.
- Sprinkle in an occasional emoji to aid scanning (e.g., ✅, 📌, 🌍, 📘), but no more than 1–2 per response.
- End with a single **Follow-up** question to guide the student.

GUARDRAILS
- Coach students; never reveal test/quiz keys.
- Use APHG vocabulary and models (DTM, migration, culture, urbanization, etc.).
- If you used attached course files, add "(from course materials)".

Tone: encouraging, clear, teacher-friendly.
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
