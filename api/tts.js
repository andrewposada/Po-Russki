// api/tts.js
// Receives: { text }
// Returns: { audioContent: "<base64 mp3>" }
// Env var: GOOGLE_TTS_API_KEY (server-side only)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, voiceName } = req.body ?? {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "text is required" });
  }

  const resolvedVoice =
    typeof voiceName === "string" && voiceName.startsWith("ru-RU-")
      ? voiceName
      : "ru-RU-Standard-A";

  const apiKey = process.env.GOOGLE_TTS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "TTS API key not configured" });
  }

  try {
    const response = await fetch(
      `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: { text },
          voice: { languageCode: "ru-RU", name: resolvedVoice },
          audioConfig: { audioEncoding: "MP3" },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("TTS API error:", err);
      return res.status(502).json({ error: "TTS request failed" });
    }

    const data = await response.json();
    return res.status(200).json({ audioContent: data.audioContent });
  } catch (e) {
    console.error("TTS handler error:", e);
    return res.status(500).json({ error: "Internal server error" });
  }
}