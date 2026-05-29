import "dotenv/config";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";

const connection = await mysql.createConnection(process.env.DATABASE_URL);
const db = drizzle(connection);

// ─── Exercises ────────────────────────────────────────────────────────────────
const exercises = [
  // CHEST
  { name: "Bench Press", nameZh: "臥推", muscleGroup: "chest", equipment: "barbell", secondaryMuscles: "triceps,shoulders", instructions: "Lie flat on bench, grip bar slightly wider than shoulder-width, lower to chest, press up.", isCustom: false },
  { name: "Incline Bench Press", nameZh: "上斜臥推", muscleGroup: "chest", equipment: "barbell", secondaryMuscles: "triceps,shoulders", instructions: "Set bench to 30-45°, press bar from upper chest.", isCustom: false },
  { name: "Decline Bench Press", nameZh: "下斜臥推", muscleGroup: "chest", equipment: "barbell", secondaryMuscles: "triceps", instructions: "Set bench to -15°, press bar from lower chest.", isCustom: false },
  { name: "Dumbbell Flyes", nameZh: "啞鈴飛鳥", muscleGroup: "chest", equipment: "dumbbell", secondaryMuscles: "shoulders", instructions: "Lie flat, arms wide, bring dumbbells together in arc motion.", isCustom: false },
  { name: "Cable Crossover", nameZh: "繩索交叉", muscleGroup: "chest", equipment: "cable_machine", secondaryMuscles: "shoulders", instructions: "Stand between cables, bring handles together in front.", isCustom: false },
  { name: "Push-Up", nameZh: "俯臥撐", muscleGroup: "chest", equipment: "bodyweight", secondaryMuscles: "triceps,shoulders", instructions: "Plank position, lower chest to floor, push back up.", isCustom: false },
  { name: "Chest Press Machine", nameZh: "胸推機", muscleGroup: "chest", equipment: "machine", secondaryMuscles: "triceps", instructions: "Sit in machine, press handles forward.", isCustom: false },
  { name: "Pec Deck Machine", nameZh: "蝴蝶機", muscleGroup: "chest", equipment: "machine", secondaryMuscles: "shoulders", instructions: "Sit in machine, bring arms together in front.", isCustom: false },

  // BACK
  { name: "Deadlift", nameZh: "硬舉", muscleGroup: "back", equipment: "barbell", secondaryMuscles: "glutes,hamstrings,traps", instructions: "Stand over bar, grip outside legs, drive hips forward to stand.", isCustom: false },
  { name: "Pull-Up", nameZh: "引體向上", muscleGroup: "back", equipment: "bodyweight", secondaryMuscles: "biceps,shoulders", instructions: "Hang from bar, pull body up until chin clears bar.", isCustom: false },
  { name: "Lat Pulldown", nameZh: "下拉訓練", muscleGroup: "back", equipment: "cable_machine", secondaryMuscles: "biceps", instructions: "Sit at machine, pull bar to upper chest.", isCustom: false },
  { name: "Barbell Row", nameZh: "槓鈴划船", muscleGroup: "back", equipment: "barbell", secondaryMuscles: "biceps,rear_delts", instructions: "Hinge at hips, row bar to lower chest.", isCustom: false },
  { name: "Dumbbell Row", nameZh: "啞鈴划船", muscleGroup: "back", equipment: "dumbbell", secondaryMuscles: "biceps", instructions: "Support on bench, row dumbbell to hip.", isCustom: false },
  { name: "Seated Cable Row", nameZh: "坐姿繩索划船", muscleGroup: "back", equipment: "cable_machine", secondaryMuscles: "biceps,rear_delts", instructions: "Sit at cable machine, pull handle to abdomen.", isCustom: false },
  { name: "T-Bar Row", nameZh: "T型划船", muscleGroup: "back", equipment: "machine", secondaryMuscles: "biceps", instructions: "Straddle T-bar, row to chest.", isCustom: false },
  { name: "Face Pull", nameZh: "面拉", muscleGroup: "back", equipment: "cable_machine", secondaryMuscles: "rear_delts,rotator_cuff", instructions: "Pull rope to face level, elbows high.", isCustom: false },

  // SHOULDERS
  { name: "Overhead Press", nameZh: "肩上推舉", muscleGroup: "shoulders", equipment: "barbell", secondaryMuscles: "triceps,traps", instructions: "Stand with bar at shoulders, press overhead.", isCustom: false },
  { name: "Dumbbell Shoulder Press", nameZh: "啞鈴肩推", muscleGroup: "shoulders", equipment: "dumbbell", secondaryMuscles: "triceps", instructions: "Seated or standing, press dumbbells overhead.", isCustom: false },
  { name: "Lateral Raise", nameZh: "側平舉", muscleGroup: "shoulders", equipment: "dumbbell", secondaryMuscles: "traps", instructions: "Raise arms to sides to shoulder height.", isCustom: false },
  { name: "Front Raise", nameZh: "前平舉", muscleGroup: "shoulders", equipment: "dumbbell", secondaryMuscles: "upper_chest", instructions: "Raise arms forward to shoulder height.", isCustom: false },
  { name: "Arnold Press", nameZh: "阿諾推舉", muscleGroup: "shoulders", equipment: "dumbbell", secondaryMuscles: "triceps", instructions: "Start with palms facing you, rotate and press overhead.", isCustom: false },
  { name: "Shoulder Press Machine", nameZh: "肩推機", muscleGroup: "shoulders", equipment: "machine", secondaryMuscles: "triceps", instructions: "Sit in machine, press handles overhead.", isCustom: false },
  { name: "Cable Lateral Raise", nameZh: "繩索側平舉", muscleGroup: "shoulders", equipment: "cable_machine", secondaryMuscles: "traps", instructions: "Stand beside cable, raise arm to side.", isCustom: false },

  // BICEPS
  { name: "Barbell Curl", nameZh: "槓鈴彎舉", muscleGroup: "biceps", equipment: "barbell", secondaryMuscles: "forearms", instructions: "Stand with bar, curl to shoulder height.", isCustom: false },
  { name: "Dumbbell Curl", nameZh: "啞鈴彎舉", muscleGroup: "biceps", equipment: "dumbbell", secondaryMuscles: "forearms", instructions: "Alternate or simultaneous curl.", isCustom: false },
  { name: "Hammer Curl", nameZh: "錘式彎舉", muscleGroup: "biceps", equipment: "dumbbell", secondaryMuscles: "forearms,brachialis", instructions: "Neutral grip curl.", isCustom: false },
  { name: "Preacher Curl", nameZh: "牧師凳彎舉", muscleGroup: "biceps", equipment: "barbell", secondaryMuscles: "forearms", instructions: "Rest arms on preacher pad, curl bar.", isCustom: false },
  { name: "Cable Curl", nameZh: "繩索彎舉", muscleGroup: "biceps", equipment: "cable_machine", secondaryMuscles: "forearms", instructions: "Stand at cable, curl handle to shoulder.", isCustom: false },
  { name: "Concentration Curl", nameZh: "集中彎舉", muscleGroup: "biceps", equipment: "dumbbell", secondaryMuscles: "forearms", instructions: "Seated, elbow on inner thigh, curl dumbbell.", isCustom: false },

  // TRICEPS
  { name: "Tricep Dip", nameZh: "三頭肌撐體", muscleGroup: "triceps", equipment: "bodyweight", secondaryMuscles: "chest,shoulders", instructions: "Support on parallel bars, lower and press.", isCustom: false },
  { name: "Close-Grip Bench Press", nameZh: "窄距臥推", muscleGroup: "triceps", equipment: "barbell", secondaryMuscles: "chest", instructions: "Bench press with narrow grip.", isCustom: false },
  { name: "Tricep Pushdown", nameZh: "三頭肌下壓", muscleGroup: "triceps", equipment: "cable_machine", secondaryMuscles: "forearms", instructions: "Stand at cable, push handle down.", isCustom: false },
  { name: "Skull Crusher", nameZh: "頭骨碎裂", muscleGroup: "triceps", equipment: "barbell", secondaryMuscles: "forearms", instructions: "Lie on bench, lower bar to forehead, extend.", isCustom: false },
  { name: "Overhead Tricep Extension", nameZh: "頭頂三頭肌伸展", muscleGroup: "triceps", equipment: "dumbbell", secondaryMuscles: "forearms", instructions: "Hold dumbbell overhead, lower behind head, extend.", isCustom: false },
  { name: "Tricep Kickback", nameZh: "三頭肌後踢", muscleGroup: "triceps", equipment: "dumbbell", secondaryMuscles: "forearms", instructions: "Hinge forward, extend arm back.", isCustom: false },

  // LEGS
  { name: "Squat", nameZh: "深蹲", muscleGroup: "legs", equipment: "barbell", secondaryMuscles: "glutes,hamstrings,core", instructions: "Bar on traps, squat to parallel, drive up.", isCustom: false },
  { name: "Leg Press", nameZh: "腿推機", muscleGroup: "legs", equipment: "machine", secondaryMuscles: "glutes,hamstrings", instructions: "Sit in machine, press platform away.", isCustom: false },
  { name: "Romanian Deadlift", nameZh: "羅馬尼亞硬舉", muscleGroup: "legs", equipment: "barbell", secondaryMuscles: "glutes,lower_back", instructions: "Hinge at hips, lower bar along legs.", isCustom: false },
  { name: "Leg Curl", nameZh: "腿彎舉", muscleGroup: "legs", equipment: "machine", secondaryMuscles: "calves", instructions: "Lie prone, curl legs toward glutes.", isCustom: false },
  { name: "Leg Extension", nameZh: "腿伸展", muscleGroup: "legs", equipment: "machine", secondaryMuscles: "quads", instructions: "Sit in machine, extend legs.", isCustom: false },
  { name: "Lunge", nameZh: "弓步蹲", muscleGroup: "legs", equipment: "bodyweight", secondaryMuscles: "glutes,hamstrings", instructions: "Step forward, lower back knee toward floor.", isCustom: false },
  { name: "Bulgarian Split Squat", nameZh: "保加利亞分腿蹲", muscleGroup: "legs", equipment: "dumbbell", secondaryMuscles: "glutes,hamstrings", instructions: "Rear foot elevated, squat on front leg.", isCustom: false },
  { name: "Calf Raise", nameZh: "提踵", muscleGroup: "legs", equipment: "machine", secondaryMuscles: "soleus", instructions: "Stand on edge, raise heels.", isCustom: false },
  { name: "Hack Squat", nameZh: "哈克深蹲", muscleGroup: "legs", equipment: "machine", secondaryMuscles: "glutes,hamstrings", instructions: "Shoulder pads on, squat on angled platform.", isCustom: false },
  { name: "Hip Thrust", nameZh: "臀推", muscleGroup: "legs", equipment: "barbell", secondaryMuscles: "hamstrings,core", instructions: "Shoulders on bench, bar on hips, thrust up.", isCustom: false },

  // CORE / ABS
  { name: "Plank", nameZh: "平板支撐", muscleGroup: "core", equipment: "bodyweight", secondaryMuscles: "shoulders,glutes", instructions: "Hold plank position, engage core.", isCustom: false },
  { name: "Crunch", nameZh: "仰臥起坐", muscleGroup: "core", equipment: "bodyweight", secondaryMuscles: "hip_flexors", instructions: "Lie on back, curl shoulders toward knees.", isCustom: false },
  { name: "Leg Raise", nameZh: "舉腿", muscleGroup: "core", equipment: "bodyweight", secondaryMuscles: "hip_flexors", instructions: "Lie flat, raise legs to 90°.", isCustom: false },
  { name: "Russian Twist", nameZh: "俄羅斯轉體", muscleGroup: "core", equipment: "bodyweight", secondaryMuscles: "obliques", instructions: "Seated, lean back, rotate torso side to side.", isCustom: false },
  { name: "Cable Crunch", nameZh: "繩索捲腹", muscleGroup: "core", equipment: "cable_machine", secondaryMuscles: "obliques", instructions: "Kneel at cable, crunch down.", isCustom: false },
  { name: "Ab Wheel Rollout", nameZh: "腹輪滾動", muscleGroup: "core", equipment: "other", secondaryMuscles: "shoulders,lats", instructions: "Kneel, roll wheel forward, return.", isCustom: false },

  // CARDIO
  { name: "Treadmill Run", nameZh: "跑步機", muscleGroup: "cardio", equipment: "machine", secondaryMuscles: "full_body", instructions: "Set speed and incline, run.", isCustom: false },
  { name: "Cycling", nameZh: "單車", muscleGroup: "cardio", equipment: "machine", secondaryMuscles: "legs,core", instructions: "Pedal at target cadence.", isCustom: false },
  { name: "Rowing Machine", nameZh: "划船機", muscleGroup: "cardio", equipment: "machine", secondaryMuscles: "back,arms,legs", instructions: "Drive with legs, pull handle to chest.", isCustom: false },
  { name: "Jump Rope", nameZh: "跳繩", muscleGroup: "cardio", equipment: "other", secondaryMuscles: "calves,shoulders", instructions: "Jump over rope at consistent pace.", isCustom: false },
  { name: "Stair Climber", nameZh: "爬樓梯機", muscleGroup: "cardio", equipment: "machine", secondaryMuscles: "glutes,legs", instructions: "Step continuously on machine.", isCustom: false },
  { name: "Elliptical", nameZh: "橢圓機", muscleGroup: "cardio", equipment: "machine", secondaryMuscles: "full_body", instructions: "Stride on elliptical machine.", isCustom: false },
];

// ─── Food Items ───────────────────────────────────────────────────────────────
const foodItems = [
  // Proteins
  { name: "Chicken Breast", nameZh: "雞胸肉", category: "protein", calories: 165, protein: 31, carbs: 0, fat: 3.6, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Salmon", nameZh: "三文魚", category: "protein", calories: 208, protein: 20, carbs: 0, fat: 13, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Tuna (canned)", nameZh: "吞拿魚罐頭", category: "protein", calories: 116, protein: 26, carbs: 0, fat: 1, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Egg", nameZh: "雞蛋", category: "protein", calories: 155, protein: 13, carbs: 1.1, fat: 11, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Egg White", nameZh: "蛋白", category: "protein", calories: 52, protein: 11, carbs: 0.7, fat: 0.2, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Beef (lean)", nameZh: "瘦牛肉", category: "protein", calories: 215, protein: 26, carbs: 0, fat: 12, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Pork Tenderloin", nameZh: "豬里脊", category: "protein", calories: 143, protein: 26, carbs: 0, fat: 3.5, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Tofu", nameZh: "豆腐", category: "protein", calories: 76, protein: 8, carbs: 1.9, fat: 4.8, fiber: 0.3, servingSize: 100, servingUnit: "g" },
  { name: "Greek Yogurt", nameZh: "希臘乳酪", category: "dairy", calories: 59, protein: 10, carbs: 3.6, fat: 0.4, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Cottage Cheese", nameZh: "農家芝士", category: "dairy", calories: 98, protein: 11, carbs: 3.4, fat: 4.3, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Whey Protein", nameZh: "乳清蛋白粉", category: "supplement", calories: 400, protein: 80, carbs: 8, fat: 5, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Shrimp", nameZh: "蝦", category: "protein", calories: 99, protein: 24, carbs: 0.2, fat: 0.3, fiber: 0, servingSize: 100, servingUnit: "g" },

  // Carbohydrates
  { name: "White Rice", nameZh: "白米飯", category: "grain", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, fiber: 0.4, servingSize: 100, servingUnit: "g" },
  { name: "Brown Rice", nameZh: "糙米", category: "grain", calories: 216, protein: 5, carbs: 45, fat: 1.8, fiber: 3.5, servingSize: 100, servingUnit: "g" },
  { name: "Oats", nameZh: "燕麥", category: "grain", calories: 389, protein: 17, carbs: 66, fat: 7, fiber: 10.6, servingSize: 100, servingUnit: "g" },
  { name: "Whole Wheat Bread", nameZh: "全麥麵包", category: "grain", calories: 247, protein: 13, carbs: 41, fat: 3.4, fiber: 6, servingSize: 100, servingUnit: "g" },
  { name: "Sweet Potato", nameZh: "番薯", category: "vegetable", calories: 86, protein: 1.6, carbs: 20, fat: 0.1, fiber: 3, servingSize: 100, servingUnit: "g" },
  { name: "Banana", nameZh: "香蕉", category: "fruit", calories: 89, protein: 1.1, carbs: 23, fat: 0.3, fiber: 2.6, servingSize: 100, servingUnit: "g" },
  { name: "Apple", nameZh: "蘋果", category: "fruit", calories: 52, protein: 0.3, carbs: 14, fat: 0.2, fiber: 2.4, servingSize: 100, servingUnit: "g" },
  { name: "Pasta", nameZh: "意粉", category: "grain", calories: 131, protein: 5, carbs: 25, fat: 1.1, fiber: 1.8, servingSize: 100, servingUnit: "g" },
  { name: "Quinoa", nameZh: "藜麥", category: "grain", calories: 120, protein: 4.4, carbs: 21, fat: 1.9, fiber: 2.8, servingSize: 100, servingUnit: "g" },

  // Vegetables
  { name: "Broccoli", nameZh: "西蘭花", category: "vegetable", calories: 34, protein: 2.8, carbs: 7, fat: 0.4, fiber: 2.6, servingSize: 100, servingUnit: "g" },
  { name: "Spinach", nameZh: "菠菜", category: "vegetable", calories: 23, protein: 2.9, carbs: 3.6, fat: 0.4, fiber: 2.2, servingSize: 100, servingUnit: "g" },
  { name: "Mixed Vegetables", nameZh: "雜菜", category: "vegetable", calories: 65, protein: 3.5, carbs: 13, fat: 0.5, fiber: 4, servingSize: 100, servingUnit: "g" },
  { name: "Avocado", nameZh: "牛油果", category: "fat", calories: 160, protein: 2, carbs: 9, fat: 15, fiber: 7, servingSize: 100, servingUnit: "g" },

  // Fats
  { name: "Olive Oil", nameZh: "橄欖油", category: "fat", calories: 884, protein: 0, carbs: 0, fat: 100, fiber: 0, servingSize: 100, servingUnit: "g" },
  { name: "Almonds", nameZh: "杏仁", category: "fat", calories: 579, protein: 21, carbs: 22, fat: 50, fiber: 12.5, servingSize: 100, servingUnit: "g" },
  { name: "Peanut Butter", nameZh: "花生醬", category: "fat", calories: 588, protein: 25, carbs: 20, fat: 50, fiber: 6, servingSize: 100, servingUnit: "g" },

  // Common HK/Asian Foods
  { name: "Wonton Noodle Soup", nameZh: "雲吞麵", category: "meal", calories: 320, protein: 18, carbs: 45, fat: 8, fiber: 2, servingSize: 400, servingUnit: "g" },
  { name: "Char Siu Rice", nameZh: "叉燒飯", category: "meal", calories: 480, protein: 25, carbs: 65, fat: 12, fiber: 1.5, servingSize: 400, servingUnit: "g" },
  { name: "Congee", nameZh: "粥", category: "meal", calories: 65, protein: 2.5, carbs: 13, fat: 0.4, fiber: 0.3, servingSize: 100, servingUnit: "g" },
  { name: "Dim Sum (mixed)", nameZh: "點心", category: "meal", calories: 280, protein: 12, carbs: 30, fat: 12, fiber: 1, servingSize: 200, servingUnit: "g" },
  { name: "Milk Tea (HK style)", nameZh: "港式奶茶", category: "beverage", calories: 150, protein: 3, carbs: 25, fat: 5, fiber: 0, servingSize: 300, servingUnit: "ml" },
  { name: "Soy Milk", nameZh: "豆漿", category: "beverage", calories: 54, protein: 3.3, carbs: 6.3, fat: 1.8, fiber: 0.6, servingSize: 250, servingUnit: "ml" },
  { name: "Protein Bar", nameZh: "蛋白棒", category: "supplement", calories: 200, protein: 20, carbs: 22, fat: 7, fiber: 3, servingSize: 60, servingUnit: "g" },
];

async function seed() {
  try {
    console.log("Seeding exercises...");
    for (const ex of exercises) {
      try {
        await connection.execute(
          `INSERT IGNORE INTO exercises (name, nameZh, muscleGroup, equipment, instructions, isCustom, userId)
           VALUES (?, ?, ?, ?, ?, ?, NULL)`,
          [ex.name, ex.nameZh, ex.muscleGroup, ex.equipment, ex.instructions, 0]
        );
      } catch (e) {
        console.warn(`Skip exercise ${ex.name}:`, e.message);
      }
    }
    console.log(`✓ ${exercises.length} exercises seeded`);

    console.log("Seeding food items...");
    for (const food of foodItems) {
      try {
        await connection.execute(
          `INSERT IGNORE INTO food_items (name, nameZh, category, calories, protein, carbs, fat, fiber)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [food.name, food.nameZh, food.category, food.calories, food.protein, food.carbs, food.fat, food.fiber]
        );
      } catch (e) {
        console.warn(`Skip food ${food.name}:`, e.message);
      }
    }
    console.log(`✓ ${foodItems.length} food items seeded`);

    console.log("✅ Seeding complete!");
  } catch (err) {
    console.error("Seed error:", err);
  } finally {
    await connection.end();
  }
}

seed();
