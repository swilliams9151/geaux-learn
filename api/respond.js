import OpenAI from "openai";

const INSTRUCTIONS = `
You are "Geaux Learn", a friendly AP Human Geography tutor for Denham Springs High School.
Coach students toward answers; never give test/quiz keys.
Use APHG vocabulary and models (DTM, migration, culture, urbanization, etc.).
If content came from course files, add "(from course materials)".
Offer brief practice (1–2 MCQs or a mini-SAQ) when helpful.
`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Enable File Search only if a vector store is set
    const vectorIds = (process.env.VECTOR_STORE_IDS || "")
      .split(",").map(s => s.trim()).filter(Boolean);

    const response = await client.responses.create({
      model: "gpt-4o-mini",
      input: messages,
      instructions: INSTRUCTIONS,
      tools: vectorIds.length ? [{ type: "file_search" }] : [],
      tool_choice: "auto",
      tool_resources: vectorIds.length
        ? { file_search: { vector_store_ids: vectorIds } }
        : undefined
    });

    // Primary path
    let text = response.output_text;

    // Fallback extraction if output_text is empty
    if (!text || !text.trim()) {
      try {
        const parts = (response.output || [])
          .flatMap(o => o.content || [])
          .filter(c => c?.type === "output_text" || c?.type === "text")
          .map(c => c?.text?.value || c?.text)
          .filter(Boolean);
        text = (parts.join("\n") || "").trim();
      } catch {}
    }

    if (!text || !text.trim()) {
      text = "I’m here, but I didn’t get any text back. Try asking again in different words.";
    }

    return res.status(200).json({ text });
  } catch (e) {
    console.error("Geaux Learn error:", e);
    // Send the error message to the frontend so you see what's wrong
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
