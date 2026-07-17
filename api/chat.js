export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { medicamento, pregunta, historial } = req.body;

  if (!medicamento?.nombre || !pregunta) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = `Eres un asistente que responde preguntas sobre medicamentos de forma clara y breve, en español. 
El usuario está tomando: "${medicamento.nombre}"${medicamento.descripcion ? ` (nota personal: ${medicamento.descripcion})` : ""}.
IMPORTANTE: No eres médico. Da información general educativa, y siempre recuerda al usuario consultar a su médico o farmacéutico para dudas específicas de dosis, interacciones o su caso particular. No des diagnósticos.`;

  const contents = [
    { role: "user", parts: [{ text: systemPrompt }] },
    {
      role: "model",
      parts: [{ text: "Entendido, responderé con esa información en mente." }],
    },
    ...(historial || []).map((m) => ({
      role: m.role === "user" ? "user" : "model",
      parts: [{ text: m.text }],
    })),
    { role: "user", parts: [{ text: pregunta }] },
  ];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      console.error(data);
      return res.status(500).json({ error: "Error consultando Gemini" });
    }

    const texto =
      data.candidates?.[0]?.content?.parts?.[0]?.text ??
      "No pude generar una respuesta.";
    return res.status(200).json({ respuesta: texto });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
