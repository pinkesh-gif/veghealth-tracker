// Groq API — Free, fast, reliable in India
// Model: llama-3.3-70b — excellent for nutrition

const BASE = 'https://api.groq.com/openai/v1/chat/completions'

async function askAI(prompt) {
  const API_KEY = import.meta.env.VITE_GROQ_API_KEY

  if (!API_KEY || API_KEY === 'undefined') {
    throw new Error('Add VITE_GROQ_API_KEY in Vercel environment variables')
  }

  const res = await fetch(BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${API_KEY}`
    },
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

export async function parseFoodEntry(text, profileStr) {
  const prompt = `You are a vegetarian nutritionist expert in Indian cuisine.
Analyze this food entry and return nutritional data as JSON.
CRITICAL: Return ONLY the JSON object. No explanation, no markdown, no text before or after.
{"name":"short food name","meal":"breakfast","calories":0,"protein":0,"carbs":0,"fat":0,"fiber":0,"water":0,"vitA":0,"vitC":0,"vitD":0,"vitE":0,"vitK":0,"vitB1":0,"vitB2":0,"vitB3":0,"vitB5":0,"vitB6":0,"vitB7":0,"vitB9":0,"vitB12":0,"iron":0,"calcium":0,"magnesium":0,"potassium":0,"zinc":0,"phosphorus":0,"sodium":0,"selenium":0,"iodine":0,"copper":0,"manganese":0}
Units: calories=kcal, protein/carbs/fat/fiber=g, water=ml, vitA/D/K/B7/B9/selenium/iodine=mcg, rest=mg
meal: breakfast/lunch/dinner/snack. All values must be numbers never null.
User profile: ${profileStr}
Food entry: "${text}"`
  const raw = await askAI(prompt)
  return extractJSON(raw)
}

export async function parseExerciseEntry(text) {
  const prompt = `Parse this exercise entry. Return ONLY JSON nothing else:
{"activity":"name","duration":30,"intensity":"medium","caloriesBurned":150}
Input: "${text}"`
  const raw = await askAI(prompt)
  return extractJSON(raw)
}

export async function parseWeightEntry(text) {
  const prompt = `Extract weight in kg. Return ONLY JSON nothing else:
{"weight":70.5}
Input: "${text}"`
  const raw = await askAI(prompt)
  return extractJSON(raw)
}

export async function getMealOpinion(parsed, profile, dayTotals, goals) {
  const prompt = `You are a warm vegetarian nutrition expert. Write exactly 2 sentences about this meal.
Person: ${profile.age}yr ${profile.gender}, ${profile.weight}kg, goal: ${profile.goal}
Meal: ${parsed.name}
Added: ${Math.round(parsed.calories||0)} cal, ${Math.round(parsed.protein||0)}g protein
Day total: ${Math.round(dayTotals.calories||0)}/${goals.calories} cal
Plain text only. Warm and friendly tone.`
  return await askAI(prompt)
}
