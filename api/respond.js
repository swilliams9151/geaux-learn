import OpenAI from "openai";

// Your Agent Builder workflow ID
const AGENT_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";

// Optional: if your Agent lives in a specific org/workspace,
// set OPENAI_ORG_ID in Vercel and we'll pass it here.
const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID || undefined
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Use POST" });

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing messages" });
    }

    // Call your Agent workflow. We do NOT send a model when invoking an Agent.
    const response = await client.responses.create({
      agent: AGENT_ID,
      input: messages
    });

    // Try simple extraction first
    let text = (response.output_text || "").trim();

    // Fallback extraction if needed
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
    console.error("Geaux Learn Agent Error:", e);
    return res.status(500).json({ error: e?.message || String(e) });
  }
}
