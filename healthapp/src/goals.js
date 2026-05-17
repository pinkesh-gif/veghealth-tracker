// Calculates personalized daily nutrient goals using
// Mifflin-St Jeor BMR formula + activity multiplier

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
  const over50 = age > 50
  const over70 = age > 70

  // Mifflin-St Jeor BMR
  const bmr = male
    ? 10 * weight + 6.25 * height - 5 * age + 5
    : 10 * weight + 6.25 * height - 5 * age - 161

  const actMult = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725, extra: 1.9 }[activity] || 1.55
  const tdee = Math.round(bmr * actMult)

  const gcal = Math.max(1200,
    goal === 'lose' ? tdee - 500 :
    goal === 'gain' ? tdee + 300 : tdee
  )

  const protein  = Math.round(weight * (goal === 'gain' ? 1.6 : 1.2))
  const fat      = Math.round((gcal * 0.28) / 9)
  const carbs    = Math.max(50, Math.round((gcal - protein * 4 - fat * 9) / 4))

  return {
    bmr: Math.round(bmr),
    tdee,
    calories:   gcal,
    protein,
    carbs,
    fat,
    fiber:      male ? (over50 ? 30 : 38) : (over50 ? 21 : 25),
    water:      Math.round(weight * 35),
    // Vitamins
    vitA:       male ? 900  : 700,
    vitC:       male ? 90   : 75,
    vitD:       over50 ? 20 : 15,
    vitE:       15,
    vitK:       male ? 120  : 90,
    vitB1:      male ? 1.2  : 1.1,
    vitB2:      male ? 1.3  : 1.1,
    vitB3:      male ? 16   : 14,
    vitB5:      5,
    vitB6:      over50 ? (male ? 1.7 : 1.5) : 1.3,
    vitB7:      30,
    vitB9:      400,
    vitB12:     2.4,
    // Minerals
    iron:       male ? 8  : (over50 ? 8  : 18),
    calcium:    (over70 || (!male && over50)) ? 1200 : 1000,
    magnesium:  male ? (age > 30 ? 420 : 400) : (age > 30 ? 320 : 310),
    potassium:  male ? 3400 : 2600,
    zinc:       male ? 11   : 8,
    phosphorus: 700,
    sodium:     1500,
    selenium:   55,
    iodine:     150,
    copper:     0.9,
    manganese:  male ? 2.3 : 1.8,
  }
}
