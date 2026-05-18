// Groq API — Free, fast, reliable in India
const BASE = 'https://api.groq.com/openai/v1/chat/completions'

async function askAI(prompt) {
  const API_KEY = import.meta.env.VITE_GROQ_API_KEY
  if (!API_KEY || API_KEY === 'undefined') throw new Error('Add VITE_GROQ_API_KEY in Vercel')

  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      max_tokens: 1024
    })
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data?.error?.message || `Error ${res.status}`)
  return data.choices?.[0]?.message?.content || ''
}

function extractJSON(raw) {
  if (!raw) throw new Error('Empty response')
  let cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()
  try { return JSON.parse(cleaned) } catch {}
  let start = cleaned.indexOf('{')
  if (start === -1) throw new Error('No JSON found')
  let depth = 0, end = -1
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) throw new Error('Incomplete JSON')
  return JSON.parse(cleaned.slice(start, end + 1))
}

// ── Food parser — with clarification check ────────────────────────
// Returns { needsClarification: true, question: '...' } if unclear
// Returns full nutrition object if clear enough
export async function parseFoodEntry(text, profileStr) {
  const prompt = `You are a precise vegetarian nutritionist with deep knowledge of Indian cuisine and ICMR-NIN food composition tables.

Analyze this food entry. If the entry is TOO VAGUE to give accurate nutrition (e.g. just "food", "ate something", no quantity for high-calorie items), return a clarification request.

Rules for clarification:
- If quantity/portion is completely missing for calorie-dense foods (rice, roti, dal, paneer) → ask
- If the food name is unclear or ambiguous → ask  
- If quantity is roughly clear (e.g. "a bowl", "2 pieces") → estimate and proceed, NO clarification needed
- Common items like "chai", "banana", "apple" → standard portion, no clarification needed

Return ONE of these two JSON formats only. No text before or after.

If clarification needed:
{"needsClarification": true, "question": "specific short question about quantity or food type"}

If clear enough — full nutrition:
{"needsClarification": false, "name":"food name","meal":"breakfast","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"water":0,"vitA":0,"vitC":0,"vitD":0,"vitE":0,"vitK":0,"vitB1":0,"vitB2":0,"vitB3":0,"vitB5":0,"vitB6":0,"vitB7":0,"vitB9":0,"vitB12":0,"iron":0,"calcium":0,"magnesium":0,"potassium":0,"zinc":0,"phosphorus":0,"sodium":0,"selenium":0,"iodine":0,"copper":0,"manganese":0}

Critical units: calories=kcal, macros=g, water=ml (water content IN food, NOT drinking water), vitA/D/K/B7/B9/selenium/iodine=mcg, rest=mg
meal: breakfast/lunch/dinner/snack
Be accurate using Indian food composition data. All values must be realistic numbers, never 0 for a food that clearly contains a nutrient.

User profile: ${profileStr}
Food entry: "${text}"`

  const raw = await askAI(prompt)
  return extractJSON(raw)
}

export async function parseExerciseEntry(text) {
  const prompt = `Parse this exercise. Return ONLY valid JSON, nothing else:
{"activity":"exercise name","duration":30,"intensity":"low|medium|high","caloriesBurned":150}
Use realistic calorie burns for Indian body weight average. Input: "${text}"`
  const raw = await askAI(prompt)
  return extractJSON(raw)
}

export async function parseWeightEntry(text) {
  const prompt = `Extract weight in kg from this text. Return ONLY valid JSON:
{"weight":70.5}
Weight must be a decimal number. Input: "${text}"`
  const raw = await askAI(prompt)
  return extractJSON(raw)
}

export async function getMealOpinion(parsed, profile, dayTotals, goals) {
  const prompt = `You are a warm, knowledgeable vegetarian nutrition expert following ICMR-NIN 2020 guidelines.

Write exactly 2 short sentences (max 25 words each) about this meal entry.

Person profile: ${profile.age}yr ${profile.gender}, ${profile.weight}kg, goal: ${profile.goal}
Meal logged: ${parsed.name}
Key nutrients added: ${Math.round(parsed.calories||0)}kcal, ${Math.round(parsed.protein||0)}g protein, ${(parsed.iron||0).toFixed(1)}mg iron, ${(parsed.vitC||0).toFixed(0)}mg VitC, ${(parsed.vitB12||0).toFixed(2)}mcg B12, ${Math.round(parsed.calcium||0)}mg calcium
Day running total: ${Math.round(dayTotals.calories||0)}/${goals.calories}kcal (${Math.round(((dayTotals.calories||0)/goals.calories)*100)}%), protein ${Math.round(dayTotals.protein||0)}/${goals.protein}g

Sentence 1: One specific positive nutritional fact about this meal.
Sentence 2: One actionable tip to improve absorption or fill a gap (vegetarian focus: B12, iron+VitC pairing, protein combining, phytate reduction).
Plain text only. No bullet points. Warm tone.`
  return await askAI(prompt)
}

export async function generateSmartTips(deficiencies, profile, todayLogs) {
  if (!deficiencies || deficiencies.length === 0) return null
  const topDef = deficiencies.slice(0, 3).map(d => `${d.l}: ${d.pct}% of goal`).join(', ')
  const prompt = `You are a vegetarian nutrition expert. Based on today's deficiencies, give 3 very specific, actionable tips.

Person: ${profile.age}yr ${profile.gender}, ${profile.weight}kg, goal: ${profile.goal}
Today's top deficiencies: ${topDef}
Today's meals: ${todayLogs.filter(l=>l.type==='food').map(l=>l.parsed?.name).filter(Boolean).join(', ') || 'none yet'}

Return ONLY valid JSON array of exactly 3 tips:
[
  {"nutrient":"nutrient name","tip":"specific actionable tip for vegetarian Indian diet","food":"best food to eat right now","urgency":"high|medium|low"},
  {"nutrient":"nutrient name","tip":"specific actionable tip","food":"best food","urgency":"high|medium|low"},
  {"nutrient":"nutrient name","tip":"specific actionable tip","food":"best food","urgency":"high|medium|low"}
]`
  try {
    const raw = await askAI(prompt)
    return extractJSON(raw)
  } catch {
    return null
  }
}
