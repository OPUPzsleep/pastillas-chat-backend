export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Método no permitido" });
  }

  const { medicamento, pregunta, historial } = req.body;

  if (!medicamento?.nombre || !pregunta) {
    return res.status(400).json({ error: "Faltan datos" });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  const systemPrompt = `Eres un asistente que ayuda a cuidadores (familiares, enfermeros, niñeras) que están dando un medicamento a otra persona y no estuvieron presentes cuando el médico dio las indicaciones originales.
El medicamento en cuestión es: "${medicamento.nombre}"${medicamento.descripcion ? ` (nota personal guardada: ${medicamento.descripcion})` : ""}.

Cuando te pregunten "para qué sirve" o algo similar, busca información actual y confiable en internet y explica de forma clara y breve, en español:
- Para qué se usa comúnmente este medicamento
- Qué debe vigilar el cuidador (efectos secundarios comunes a notar)

IMPORTANTE:
- No eres médico ni farmacéutico. No dosis, no diagnósticos, no digas si "está bien" combinarlo con otra cosa.
- Siempre cierra recordando que ante cualquier duda de dosis, interacciones o síntomas raros, deben llamar al médico o farmacéutico que indicó el tratamiento.
- Si no encuentras información confiable sobre el medicamento, dilo claramente en vez de inventar.`;

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
        body: JSON.stringify({
          contents,
          tools: [{ google_search: {} }],
        }),
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

    const fuentes =
      data.candidates?.[0]?.groundingMetadata?.groundingChunks
        ?.map((chunk) => chunk.web?.uri)
        .filter(Boolean) ?? [];

    return res.status(200).json({ respuesta: texto, fuentes });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Error del servidor" });
  }
}
