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
    if (!Array.isArray(messages)) return res.status(400).json({ error: "Missing messages" });

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Optional: comma-separated vector store IDs via Vercel env
    const vectorIds = (process.env.VECTOR_STORE_IDS || "")
      .split(",").map(s => s.trim()).filter(Boolean);

    const response = await client.responses.create({
      model: "gpt-5.2-mini",
      input: messages,
      instructions: INSTRUCTIONS,
      tools: vectorIds.length ? [{ type: "file_search" }] : [],
      tool_choice: "auto",
      tool_resources: vectorIds.length ? { file_search: { vector_store_ids: vectorIds } } : undefined
    });

    res.status(200).json({ text: response.output_text ?? "" });
  } catch (e) {
    console.error("Agent error:", e?.message || e);
    res.status(500).json({ error: "Agent error" });
  }
}
