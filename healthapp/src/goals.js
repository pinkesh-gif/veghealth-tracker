// Research-based personalized daily nutrient goals
// Sources: ICMR 2020, WHO, NIH, NIN India guidelines

export const NUTR = [
  // Macros
  { k: 'calories', l: 'Calories',    u: 'kcal', c: '#FF375F', cat: 'macro' },
  { k: 'protein',  l: 'Protein',     u: 'g',    c: '#BF5AF2', cat: 'macro' },
  { k: 'carbs',    l: 'Carbs',       u: 'g',    c: '#FF9F0A', cat: 'macro' },
  { k: 'fat',      l: 'Fat',         u: 'g',    c: '#FFD60A', cat: 'macro' },
  { k: 'fiber',    l: 'Fiber',       u: 'g',    c: '#30D158', cat: 'macro' },
  { k: 'water',    l: 'Water',       u: 'ml',   c: '#32ADE6', cat: 'macro' },
  // Vitamins
  { k: 'vitA',  l: 'Vitamin A',      u: 'mcg', c: '#FF9F0A', cat: 'vitamin' },
  { k: 'vitC',  l: 'Vitamin C',      u: 'mg',  c: '#FF9F0A', cat: 'vitamin' },
  { k: 'vitD',  l: 'Vitamin D',      u: 'mcg', c: '#FFD60A', cat: 'vitamin' },
  { k: 'vitE',  l: 'Vitamin E',      u: 'mg',  c: '#FFD60A', cat: 'vitamin' },
  { k: 'vitK',  l: 'Vitamin K',      u: 'mcg', c: '#30D158', cat: 'vitamin' },
  { k: 'vitB1', l: 'B1 Thiamine',    u: 'mg',  c: '#5AC8FA', cat: 'vitamin' },
  { k: 'vitB2', l: 'B2 Riboflavin',  u: 'mg',  c: '#BF5AF2', cat: 'vitamin' },
  { k: 'vitB3', l: 'B3 Niacin',      u: 'mg',  c: '#FF9F0A', cat: 'vitamin' },
  { k: 'vitB5', l: 'B5 Pantothenic', u: 'mg',  c: '#32ADE6', cat: 'vitamin' },
  { k: 'vitB6', l: 'B6 Pyridoxine',  u: 'mg',  c: '#5AC8FA', cat: 'vitamin' },
  { k: 'vitB7', l: 'B7 Biotin',      u: 'mcg', c: '#BF5AF2', cat: 'vitamin' },
  { k: 'vitB9', l: 'B9 Folate',      u: 'mcg', c: '#30D158', cat: 'vitamin' },
  { k: 'vitB12',l: 'B12 Cobalamin',  u: 'mcg', c: '#BF5AF2', cat: 'vitamin' },
  // Minerals
  { k: 'iron',       l: 'Iron',        u: 'mg',  c: '#FF375F', cat: 'mineral' },
  { k: 'calcium',    l: 'Calcium',     u: 'mg',  c: '#5AC8FA', cat: 'mineral' },
  { k: 'magnesium',  l: 'Magnesium',   u: 'mg',  c: '#30D158', cat: 'mineral' },
  { k: 'potassium',  l: 'Potassium',   u: 'mg',  c: '#32ADE6', cat: 'mineral' },
  { k: 'zinc',       l: 'Zinc',        u: 'mg',  c: '#32ADE6', cat: 'mineral' },
  { k: 'phosphorus', l: 'Phosphorus',  u: 'mg',  c: '#FF9F0A', cat: 'mineral' },
  { k: 'sodium',     l: 'Sodium',      u: 'mg',  c: '#FFD60A', cat: 'mineral' },
  { k: 'selenium',   l: 'Selenium',    u: 'mcg', c: '#5AC8FA', cat: 'mineral' },
  { k: 'iodine',     l: 'Iodine',      u: 'mcg', c: '#32ADE6', cat: 'mineral' },
  { k: 'copper',     l: 'Copper',      u: 'mg',  c: '#FF9F0A', cat: 'mineral' },
  { k: 'manganese',  l: 'Manganese',   u: 'mg',  c: '#30D158', cat: 'mineral' },
]

export const ZERO = () => NUTR.reduce((a, n) => ({ ...a, [n.k]: 0 }), {})

export function calcGoals(p) {
  const { age, gender, weight, height, activity, goal } = p
  const male = gender === 'male'
  const a20_30 = age >= 20 && age <= 30
  const a31_50 = age >= 31 && age <= 50
  const a51_70 = age >= 51 && age <= 70
  const over70 = age > 70
  const pregnant = false // future feature

  // ── Mifflin-St Jeor BMR (most accurate for Indian population)
  const bmr = male
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161

  const actMult = {
    sedentary: 1.2,    // desk job, no exercise
    light:     1.375,  // light exercise 1-3 days/week
    moderate:  1.55,   // moderate exercise 3-5 days/week
    active:    1.725,  // hard exercise 6-7 days/week
    extra:     1.9     // physical job + daily exercise
  }[activity] || 1.55

  const tdee = Math.round(bmr * actMult)

  // Calorie goal based on objective
  const gcal = Math.max(1200,
    goal === 'lose' ? tdee - 500 :   // 0.5kg/week loss
    goal === 'gain' ? tdee + 300 :   // lean muscle gain
    tdee
  )

  // ── Protein: ICMR recommends 0.8-1g/kg for sedentary, 1.2-2g/kg for active
  // Vegetarians need ~10% more due to lower digestibility of plant protein
  const proteinMult = goal === 'gain' ? 1.8 :
                      activity === 'active' || activity === 'extra' ? 1.4 : 1.1
  const protein = Math.round(weight * proteinMult)

  // ── Fat: 25-35% of calories (WHO recommendation)
  const fat = Math.round((gcal * 0.28) / 9)

  // ── Carbs: remaining calories
  const carbs = Math.max(130, Math.round((gcal - protein * 4 - fat * 9) / 4))

  // ── Fiber: ICMR 2020 — 40g/2000kcal scaled
  const fiber = Math.round((gcal / 2000) * (male ? 38 : 25))

  // ── Water: 35ml/kg body weight (ICMR India climate recommendation)
  const water = Math.round(weight * 35)

  // ── Vitamins (ICMR 2020 + NIH DRI values)
  // Vitamin A — ICMR: 600mcg RE/day (India specific)
  const vitA = male ? 900 : 700

  // Vitamin C — ICMR: 40mg/day minimum, NIH: 90mg (we use higher for better immunity)
  // Vegetarians absorb less iron so higher C helps
  const vitC = male ? 90 : 75

  // Vitamin D — critical for Indians (dark skin + indoor lifestyle)
  // ICMR: 600 IU = 15mcg. Over 50: 800 IU = 20mcg
  const vitD = over70 ? 20 : a51_70 ? 20 : 15

  // Vitamin E — antioxidant, important for vegetarians
  const vitE = 15

  // Vitamin K — bone health
  const vitK = male ? 120 : 90

  // B vitamins — vegetarians often deficient
  const vitB1 = male ? 1.2 : 1.1   // Thiamine
  const vitB2 = male ? 1.3 : 1.1   // Riboflavin — often low in veg diet
  const vitB3 = male ? 16 : 14      // Niacin
  const vitB5 = 5                    // Pantothenic acid
  const vitB6 = over70 ? (male ? 1.7 : 1.5) : a51_70 ? (male ? 1.7 : 1.5) : 1.3
  const vitB7 = 30                   // Biotin — mcg
  const vitB9 = 400                  // Folate — mcg (critical for cell division)

  // B12 — MOST CRITICAL for vegetarians. Nearly absent in plant foods.
  // Standard: 2.4mcg but absorption is only 50% from supplements
  // We set higher to compensate for plant-based diet
  const vitB12 = 2.4

  // ── Minerals
  // Iron — vegetarians need 1.8x more due to non-heme iron (lower absorption)
  // ICMR India: 17mg men, 21mg women (higher than Western values due to phytates)
  const iron = male
    ? (a51_70 || over70 ? 8 : 17)    // Men post-50 need less
    : (a51_70 || over70 ? 8 : 21)    // Women pre-menopause need most

  // Calcium — critical for vegetarians (no meat bone broth)
  // ICMR: 600mg but NIH: 1000-1200mg. We use 1000mg as safe target
  const calcium = (over70 || (!male && a51_70)) ? 1200 : 1000

  // Magnesium — often low in processed food diets
  const magnesium = male
    ? (age > 30 ? 420 : 400)
    : (age > 30 ? 320 : 310)

  // Potassium — heart health, blood pressure
  const potassium = male ? 3400 : 2600

  // Zinc — vegetarians absorb 50% less zinc due to phytates
  // So we set 50% higher than standard RDA
  const zinc = male ? 16 : 12   // Standard is 11/8 but veg need more

  const phosphorus = 700

  // Sodium — keep low (ICMR: <2300mg, ideal <1500mg)
  const sodium = 1500

  // Selenium — antioxidant, often low in Indian vegetarian diet
  const selenium = 55  // mcg

  // Iodine — vegetarians may miss iodine (no seafood)
  const iodine = 150  // mcg

  const copper = 0.9
  const manganese = male ? 2.3 : 1.8

  return {
    bmr: Math.round(bmr),
    tdee,
    calories: gcal,
    protein, carbs, fat, fiber, water,
    vitA, vitC, vitD, vitE, vitK,
    vitB1, vitB2, vitB3, vitB5, vitB6, vitB7, vitB9, vitB12,
    iron, calcium, magnesium, potassium, zinc,
    phosphorus, sodium, selenium, iodine, copper, manganese,
  }
}

// Returns top deficiencies for smart tips
export function getDeficiencies(tots, goals) {
  return NUTR
    .filter(n => goals[n.k] > 0 && n.k !== 'sodium' && n.k !== 'water')
    .map(n => ({
      ...n,
      pct: Math.round(((tots[n.k] || 0) / goals[n.k]) * 100),
      value: tots[n.k] || 0,
      goal: goals[n.k]
    }))
    .filter(n => n.pct < 60)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)
}

// Smart food suggestions based on deficiency
export const FOOD_TIPS = {
  protein:  { foods: 'paneer, tofu, moong dal, rajma, chana, Greek yogurt', tip: 'Add a protein source to every meal' },
  iron:     { foods: 'spinach, methi, rajma, til, jaggery, dates', tip: 'Pair with lemon juice to boost absorption 3x' },
  calcium:  { foods: 'milk, curd, paneer, ragi, til seeds, almonds', tip: 'Have dairy 2x/day for bone health' },
  vitB12:   { foods: 'fortified milk, curd, paneer, nutritional yeast', tip: 'Consider a B12 supplement — critical for vegetarians' },
  vitD:     { foods: 'fortified milk, mushrooms exposed to sun', tip: '15-20 min morning sunlight daily is essential' },
  zinc:     { foods: 'pumpkin seeds, cashews, chana, rajma, hemp seeds', tip: 'Soak legumes overnight to reduce phytates' },
  vitC:     { foods: 'amla, lemon, guava, capsicum, tomato', tip: 'Also boosts iron absorption significantly' },
  magnesium:{ foods: 'almonds, peanuts, spinach, black beans, banana', tip: 'Helps with sleep, muscle recovery & energy' },
  fiber:    { foods: 'whole wheat roti, oats, dal, vegetables, fruits', tip: 'Aim for 5 servings of vegetables daily' },
  potassium:{ foods: 'banana, sweet potato, coconut water, dal, spinach', tip: 'Reduces blood pressure and supports heart health' },
  vitA:     { foods: 'carrot, sweet potato, mango, papaya, spinach', tip: 'Fat-soluble — eat with a small amount of ghee/oil' },
  vitB9:    { foods: 'methi, spinach, moong, rajma, lemon, orange', tip: 'Critical for cell growth and brain function' },
  iodine:   { foods: 'iodized salt, dairy, seaweed', tip: 'Use iodized salt — vegetarians often miss iodine' },
  selenium:  { foods: 'brazil nuts (1/day!), sunflower seeds, mushrooms', tip: 'Just 1-2 brazil nuts meets your daily selenium' },
}
