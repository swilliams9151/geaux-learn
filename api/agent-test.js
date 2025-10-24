import OpenAI from "openai";
const AGENT_ID = "wf_68f8c07d88888190a77420411e0b85f80ac663618d486887";

export default async function handler(req, res) {
  try {
    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG_ID || undefined
    });
    const r = await client.responses.create({
      agent: AGENT_ID,
      input: "Say 'Hello from the Geaux Learn Agent!' in one sentence."
    });
    res.status(200).json({ text: r.output_text });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
