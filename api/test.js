import OpenAI from "openai";
export default async function handler(req, res) {
  try {
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const r = await client.responses.create({
      model: "gpt-4o-mini",
      input: "Say 'Hello from Geaux Learn!'"
    });
    res.status(200).json({ text: r.output_text });
  } catch (e) {
    res.status(500).json({ error: e?.message || String(e) });
  }
}
