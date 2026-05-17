// v2
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

async function askGemini(prompt) {
  const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
  if (!API_KEY) throw new Error('API key not found')
  const res = await fetch(`${BASE}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || 'Gemini error')
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

function extractJSON(raw) {
  if (!raw) throw new Error('Empty response')
  let cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  let start = cleaned.indexOf('{')
  if (start === -1) throw new Error('No JSON found')
  let depth = 0, end = -1
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] =
