// ── ICMR-NIN 2020 + NIH DRI Research-Based Goals ─────────────────
// Sources:
// - ICMR-NIN RDA & EAR 2020 (India specific)
// - Indian Food Composition Tables NIN-ICMR 2017
// - WHO Nutrient Requirements
// - NIH Dietary Reference Intakes (DRI)
// - Vegetarian adjustments: 1.8x iron, 1.5x zinc (phytate reduction)
// - Water: ICMR India hot climate = 35-45ml/kg/day (total fluid)
//   NOTE: Water here = DRINKING water only. Food contributes ~1L/day.
//   We track DRINKING water separately for accuracy.

export const NUTR = [
  { k:'calories',  l:'Calories',      u:'kcal', c:'#FF375F', cat:'macro' },
  { k:'protein',   l:'Protein',       u:'g',    c:'#BF5AF2', cat:'macro' },
  { k:'carbs',     l:'Carbohydrates', u:'g',    c:'#FF9F0A', cat:'macro' },
  { k:'fat',       l:'Fat',           u:'g',    c:'#FFD60A', cat:'macro' },
  { k:'fiber',     l:'Fiber',         u:'g',    c:'#30D158', cat:'macro' },
  { k:'water',     l:'Water (food)',  u:'ml',   c:'#32ADE6', cat:'macro' },
  { k:'vitA',  l:'Vitamin A',         u:'mcg',  c:'#FF9F0A', cat:'vitamin' },
  { k:'vitC',  l:'Vitamin C',         u:'mg',   c:'#FF9F0A', cat:'vitamin' },
  { k:'vitD',  l:'Vitamin D',         u:'mcg',  c:'#FFD60A', cat:'vitamin' },
  { k:'vitE',  l:'Vitamin E',         u:'mg',   c:'#FFD60A', cat:'vitamin' },
  { k:'vitK',  l:'Vitamin K',         u:'mcg',  c:'#30D158', cat:'vitamin' },
  { k:'vitB1', l:'B1 Thiamine',       u:'mg',   c:'#5AC8FA', cat:'vitamin' },
  { k:'vitB2', l:'B2 Riboflavin',     u:'mg',   c:'#BF5AF2', cat:'vitamin' },
  { k:'vitB3', l:'B3 Niacin',         u:'mg',   c:'#FF9F0A', cat:'vitamin' },
  { k:'vitB5', l:'B5 Pantothenic',    u:'mg',   c:'#32ADE6', cat:'vitamin' },
  { k:'vitB6', l:'B6 Pyridoxine',     u:'mg',   c:'#5AC8FA', cat:'vitamin' },
  { k:'vitB7', l:'B7 Biotin',         u:'mcg',  c:'#BF5AF2', cat:'vitamin' },
  { k:'vitB9', l:'B9 Folate',         u:'mcg',  c:'#30D158', cat:'vitamin' },
  { k:'vitB12',l:'B12 Cobalamin',     u:'mcg',  c:'#BF5AF2', cat:'vitamin' },
  { k:'iron',       l:'Iron',         u:'mg',   c:'#FF375F', cat:'mineral' },
  { k:'calcium',    l:'Calcium',      u:'mg',   c:'#5AC8FA', cat:'mineral' },
  { k:'magnesium',  l:'Magnesium',    u:'mg',   c:'#30D158', cat:'mineral' },
  { k:'potassium',  l:'Potassium',    u:'mg',   c:'#32ADE6', cat:'mineral' },
  { k:'zinc',       l:'Zinc',         u:'mg',   c:'#32ADE6', cat:'mineral' },
  { k:'phosphorus', l:'Phosphorus',   u:'mg',   c:'#FF9F0A', cat:'mineral' },
  { k:'sodium',     l:'Sodium',       u:'mg',   c:'#FFD60A', cat:'mineral' },
  { k:'selenium',   l:'Selenium',     u:'mcg',  c:'#5AC8FA', cat:'mineral' },
  { k:'iodine',     l:'Iodine',       u:'mcg',  c:'#32ADE6', cat:'mineral' },
  { k:'copper',     l:'Copper',       u:'mg',   c:'#FF9F0A', cat:'mineral' },
  { k:'manganese',  l:'Manganese',    u:'mg',   c:'#30D158', cat:'mineral' },
]

export const ZERO = () => NUTR.reduce((a, n) => ({ ...a, [n.k]: 0 }), {})

export function calcGoals(p, customGoals = {}) {
  const { age, gender, weight, height, activity, goal } = p
  const male = gender === 'male'

  // ── BMR: Mifflin-St Jeor (validated for Indian population)
  const bmr = male
    ? (10 * weight + 6.25 * height - 5 * age + 5)
    : (10 * weight + 6.25 * height - 5 * age - 161)

  const actMult = {
    sedentary: 1.2,
    light:     1.375,
    moderate:  1.55,
    active:    1.725,
    extra:     1.9
  }[activity] || 1.55

  const tdee = Math.round(bmr * actMult)

  const gcal = Math.max(1200,
    goal === 'lose' ? tdee - 500 :
    goal === 'gain' ? tdee + 300 : tdee
  )

  // ── Protein: ICMR 2020 = 0.83g/kg/day (sedentary)
  // Athletes/active: 1.2-1.6g/kg. Gain muscle: up to 2g/kg.
  // Vegetarians: +10% due to lower plant protein digestibility
  const baseProtMult =
    goal === 'gain' ? 1.8 :
    activity === 'active' || activity === 'extra' ? 1.4 :
    activity === 'moderate' ? 1.1 : 0.91 // 0.83 * 1.1 vegetarian adj
  const protein = Math.round(weight * baseProtMult)

  // ── Fat: 20-30% of calories (ICMR India recommendation)
  const fat = Math.round((gcal * 0.27) / 9)

  // ── Carbs: remainder after protein and fat
  const carbs = Math.max(130, Math.round((gcal - protein * 4 - fat * 9) / 4))

  // ── Fiber: ICMR = 40g/2000kcal. Scale to individual calorie need.
  const fiber = Math.round((gcal / 2000) * (male ? 38 : 30))

  // ── Water: ICMR India hot climate recommendation
  // Total fluid need = ~35ml/kg/day
  // Food provides ~800-1000ml/day
  // So DRINKING water goal = total - food water = ~25ml/kg
  // We show food water from diet separately
  // This field tracks water content FROM FOOD only (dal, curd, fruits etc)
  const water = Math.round(weight * 25) // ml from food sources

  // ── Vitamins (ICMR-NIN 2020 RDA)
  const vitA  = male ? 900  : 700     // mcg RE/day
  const vitC  = male ? 65   : 65      // mg/day ICMR (40mg minimum, 65mg optimal)
  const vitD  = age > 50 ? 20 : 15    // mcg/day (600-800 IU)
  const vitE  = 10                     // mg/day (ICMR: 10mg alpha-TE)
  const vitK  = male ? 120 : 90       // mcg/day
  const vitB1 = male ? 1.4 : 1.1      // mg/day (ICMR 2020)
  const vitB2 = male ? 1.6 : 1.2      // mg/day (ICMR 2020, higher than NIH)
  const vitB3 = male ? 18  : 14       // mg NE/day
  const vitB5 = 5                      // mg/day
  const vitB6 = age > 50 ? (male ? 1.7 : 1.5) : 1.3  // mg/day
  const vitB7 = 30                     // mcg/day
  const vitB9 = 400                    // mcg DFE/day (critical for all)
  const vitB12 = 2.4                   // mcg/day — supplement strongly advised for veg

  // ── Minerals (ICMR-NIN 2020 RDA — India specific values)
  // Iron: ICMR India values are HIGHER than Western due to:
  // - Plant-based non-heme iron = 5-10% absorption (vs heme 25-35%)
  // - High phytate diet (roti, rice) further reduces absorption
  // ICMR 2020: Men=17mg, Women=21mg (pre-menopausal)
  const iron = male
    ? (age > 50 ? 8 : 17)
    : (age > 50 ? 8 : 21)

  // Calcium: ICMR 2020 = 800mg/day (lower than Western 1000mg)
  // But for vegetarians without dairy = keep at 1000mg
  const calcium = age > 50 ? 1200 : 1000

  // Magnesium: ICMR 2020
  const magnesium = male
    ? (age > 30 ? 420 : 400)
    : (age > 30 ? 320 : 310)

  // Potassium: 3500mg/day (WHO recommendation for blood pressure)
  const potassium = 3500

  // Zinc: ICMR 2020 = 12mg men, 10mg women
  // Vegetarians: multiply by 1.5 due to phytate inhibition
  // ICMR already accounts for Indian diet phytates to some extent
  const zinc = male ? 14 : 10

  const phosphorus = 700   // mg/day
  // Sodium: ICMR & WHO = <2000mg/day. Ideal <1500mg.
  const sodium = 1800      // mg/day (realistic Indian cooking)
  // Selenium: ICMR 2020 = 40mcg/day (lower than NIH 55mcg)
  const selenium = 40      // mcg/day
  // Iodine: ICMR 2020 = 150mcg/day
  const iodine = 150       // mcg/day
  // Copper: ICMR 2020 = 2mg/day
  const copper = 2.0       // mg/day
  // Manganese: ICMR 2020 = 4mg/day (higher than NIH)
  const manganese = 4.0    // mg/day

  const calculated = {
    bmr: Math.round(bmr), tdee,
    calories: gcal, protein, carbs, fat, fiber, water,
    vitA, vitC, vitD, vitE, vitK,
    vitB1, vitB2, vitB3, vitB5, vitB6, vitB7, vitB9, vitB12,
    iron, calcium, magnesium, potassium, zinc,
    phosphorus, sodium, selenium, iodine, copper, manganese,
  }

  // Apply custom goal overrides
  return { ...calculated, ...customGoals }
}

// ── Get top deficiencies for smart tips ───────────────────────────
export function getDeficiencies(tots, goals) {
  return NUTR
    .filter(n => goals[n.k] > 0 && n.k !== 'sodium')
    .map(n => ({
      ...n,
      pct: Math.min(Math.round(((tots[n.k] || 0) / goals[n.k]) * 100), 100),
      value: tots[n.k] || 0,
      goal: goals[n.k]
    }))
    .filter(n => n.pct < 70)
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 5)
}

// ── Food tips mapped to each nutrient ────────────────────────────
export const FOOD_TIPS = {
  protein:    { emoji:'💪', foods:'paneer, tofu, moong dal, rajma, chana, curd, soya chunks', tip:'Add protein to every meal. Dal + roti = complete amino acids.' },
  iron:       { emoji:'🩸', foods:'palak, methi, rajma, til, jaggery, dates, chana', tip:'Always pair iron foods with Vitamin C (lemon juice) — boosts absorption 3x.' },
  calcium:    { emoji:'🦴', foods:'milk, curd, paneer, ragi, til seeds, almonds, rajma', tip:'Have 2-3 servings of dairy daily. Ragi has more calcium than milk per gram.' },
  vitB12:     { emoji:'💊', foods:'dairy, fortified milk, curd, paneer, nutritional yeast', tip:'B12 is nearly absent in plant foods. A daily B12 supplement is strongly advised.' },
  vitD:       { emoji:'☀️', foods:'fortified milk, sun-exposed mushrooms, egg yolk', tip:'15-20 min morning sunlight (8-10am) on skin daily is your best source.' },
  zinc:       { emoji:'⚡', foods:'pumpkin seeds, cashews, chana, rajma, hemp seeds, oats', tip:'Soak legumes overnight to reduce phytates and improve zinc absorption.' },
  vitC:       { emoji:'🍊', foods:'amla (highest!), guava, lemon, capsicum, tomato, sprouts', tip:'One amla has 600mg Vitamin C. Also massively boosts iron absorption.' },
  magnesium:  { emoji:'🌙', foods:'almonds, peanuts, dark chocolate, banana, palak, seeds', tip:'Magnesium improves sleep, reduces cramps, and boosts energy production.' },
  fiber:      { emoji:'🌾', foods:'whole wheat roti, oats, rajma, all vegetables, fruits with peel', tip:'Aim for 5 fistfuls of vegetables daily. Soluble fiber feeds good gut bacteria.' },
  potassium:  { emoji:'🫀', foods:'banana, coconut water, sweet potato, dal, palak, avocado', tip:'Potassium reduces blood pressure and balances sodium effects.' },
  vitA:       { emoji:'👁️', foods:'carrot, sweet potato, mango, papaya, palak, pumpkin', tip:'Fat-soluble — eat with a small amount of ghee or oil for better absorption.' },
  vitB9:      { emoji:'🧬', foods:'methi, palak, moong, rajma, lemon, orange, asparagus', tip:'Critical for DNA repair and cell growth. Cook gently to preserve folate.' },
  vitB2:      { emoji:'⚡', foods:'milk, curd, almonds, palak, whole grains, mushrooms', tip:'B2 is destroyed by light — keep milk in opaque containers.' },
  iodine:     { emoji:'🧠', foods:'iodized salt, dairy, seaweed, fortified foods', tip:'Use iodized salt. Vegetarians often miss iodine due to no seafood.' },
  selenium:   { emoji:'🛡️', foods:'brazil nuts (1-2/day!), sunflower seeds, mushrooms, whole grains', tip:'Just 2 brazil nuts meets your entire selenium requirement for the day.' },
  vitE:       { emoji:'🌟', foods:'sunflower seeds, almonds, peanut butter, avocado, olive oil', tip:'Vitamin E protects cells from damage and supports immune function.' },
  water:      { emoji:'💧', foods:'dal, curd, lassi, fruits, vegetables, soups', tip:'Drink 8-10 glasses of water daily. More in summer or after exercise.' },
}
