// Gemini 2.0 Flash API — robust JSON extraction

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const BASE = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

// ── Core API call ──────────────────────────────────────────────────
export async function askGemini(prompt) {
  if (!API_KEY) throw new Error('API_KEY_MISSING')
  const res = await fetch(`${BASE}?key=${API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.1, maxOutputTokens: 1024 }
    })
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message || `HTTP ${res.status}`)
  }
  const data = await res.json()
  return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
}

// ── Robust JSON extractor ──────────────────────────────────────────
// Handles: ```json ... ```, plain text before/after, nested objects
function extractJSON(raw) {
  if (!raw) throw new Error('Empty response')

  // 1. Strip markdown code fences
  let cleaned = raw.replace(/```[a-z]*\n?/gi, '').replace(/```/g, '').trim()

  // 2. Try direct parse first
  try { return JSON.parse(cleaned) } catch {}

  // 3. Find first { ... } block using brace counting
  let start = cleaned.indexOf('{')
  if (start === -1) throw new Error('No JSON object found in response')
  let depth = 0, end = -1
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') depth++
    else if (cleaned[i] === '}') { depth--; if (depth === 0) { end = i; break } }
  }
  if (end === -1) throw new Error('Incomplete JSON in response')

  try { return JSON.parse(cleaned.slice(start, end + 1)) }
  catch { throw new Error('Could not parse JSON from response') }
}

// ── Food parser ────────────────────────────────────────────────────
export async function parseFoodEntry(text, profileStr) {
  const prompt = `You are a vegetarian nutritionist expert in Indian cuisine.
Analyze this food entry and return nutritional data as JSON.

CRITICAL: Return ONLY the JSON object. No explanation, no markdown, no text before or after.

Required format:
{"name":"short food name","meal":"breakfast","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"water":0,"vitA":0,"vitC":0,"vitD":0,"vitE":0,"vitK":0,"vitB1":0,"vitB2":0,"vitB3":0,"vitB5":0,"vitB6":0,"vitB7":0,"vitB9":0,"vitB12":0,"iron":0,"calcium":0,"magnesium":0,"potassium":0,"zinc":0,"phosphorus":0,"sodium":0,"selenium":0,"iodine":0,"copper":0,"manganese":0}

Units: calories=kcal, protein/carbs/fat/fiber=g, water=ml, vitA/D/K/B7/B9/selenium/iodine=mcg, rest=mg
meal must be one of: breakfast, lunch, dinner, snack
Estimate realistic values for Indian vegetarian food. Never return null or undefined.

User profile: ${profileStr}
Food entry: "${text}"`

  const raw = await askGemini(prompt)
  return extractJSON(raw)
}

// ── Exercise parser ────────────────────────────────────────────────
export async function parseExerciseEntry(text) {
  const prompt = `Parse this exercise entry and return JSON.
CRITICAL: Return ONLY the JSON object, nothing else.
{"activity":"activity name","duration":30,"intensity":"medium","caloriesBurned":150}
intensity must be: low, medium, or high
Input: "${text}"`

  const raw = await askGemini(prompt)
  return extractJSON(raw)
}

// ── Weight parser ──────────────────────────────────────────────────
export async function parseWeightEntry(text) {
  const prompt = `Extract the weight value from this text and return JSON.
CRITICAL: Return ONLY the JSON object, nothing else.
{"weight":70.5}
weight must be a number in kg.
Input: "${text}"`

  const raw = await askGemini(prompt)
  return extractJSON(raw)
}

// ── Meal opinion ───────────────────────────────────────────────────
export async function getMealOpinion(parsed, profile, dayTotals, goals) {
  const prompt = `You are a warm vegetarian nutrition expert. Write exactly 2 sentences about this meal.

Person: ${profile.age}yr ${profile.gender}, ${profile.weight}kg, goal: ${profile.goal}
Meal: ${parsed.name}
Added: ${Math.round(parsed.calories||0)} cal, ${Math.round(parsed.protein||0)}g protein, ${(parsed.iron||0).toFixed(1)}mg iron, ${(parsed.vitB12||0).toFixed(2)}mcg B12
Day total so far: ${Math.round(dayTotals.calories||0)}/${goals.calories} cal, ${Math.round(dayTotals.protein||0)}/${goals.protein}g protein

Sentence 1: one positive thing about this food.
Sentence 2: one actionable vegetarian nutrition tip (B12, iron absorption, protein combining, etc).
Plain text only. Warm and friendly tone.`

  return await askGemini(prompt)
}
