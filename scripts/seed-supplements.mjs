import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Owner user ID
const OWNER_USER_ID = 2;

// Map timeOfDay to DB enum values
// 餐前 = pre_meal (map to pre_workout), 餐後 = post_meal (map to post_workout)
// We'll use 'morning' as default when no time specified

const supplements = [
  {
    name: 'Water Out™',
    nameZh: 'Water Out™',
    brand: 'NOW Foods',
    category: 'other',
    servingSize: '2 capsules',
    timeOfDay: 'pre_workout', // 餐前
    source: 'iHerb',
    dailyDose: 2,
  },
  {
    name: 'Silymarin Complex with Milk Thistle Extract plus Dandelion, Artichoke, Ginger and BioPerine®',
    nameZh: '水飛薊素複合物素食膠囊，含水飛薊提取物，加蒲公英、洋薊、生姜和 BioPerine 成分',
    brand: 'California Gold Nutrition',
    category: 'other',
    servingSize: '1 capsule',
    timeOfDay: 'post_workout', // 餐後
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Astaxanthin, Astalif® Pure Icelandic, 12 mg',
    nameZh: '蝦青素，Astalif® 全冰島，12 毫克',
    brand: 'California Gold Nutrition',
    category: 'vitamin',
    servingSize: '1 softgel',
    timeOfDay: 'post_workout', // 餐後
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'NMN, 175 mg',
    nameZh: 'NMN，175 毫克',
    brand: 'California Gold Nutrition',
    category: 'other',
    servingSize: '2 capsules',
    timeOfDay: 'pre_workout', // 餐前
    source: 'iHerb',
    dailyDose: 2,
  },
  {
    name: 'Testosterone Booster',
    nameZh: '促睾物質',
    brand: 'SIXSTAR',
    category: 'pre_workout',
    servingSize: '1 capsule',
    timeOfDay: 'pre_workout', // 餐前
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: "Men's Active Sport Multi",
    nameZh: '男性專用多功能運動能量補充軟凝膠',
    brand: 'NOW Foods',
    category: 'vitamin',
    servingSize: '2 softgels',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 2,
  },
  {
    name: 'LactoBif® 100 Probiotics, 100 Billion CFU',
    nameZh: 'LactoBif® 100 益生菌素食膠囊，含 5 種乳酸桿菌和 3 種雙歧桿菌，1000 億 CFU',
    brand: 'California Gold Nutrition',
    category: 'probiotic',
    servingSize: '1 capsule',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Resveratrol, 200 mg',
    nameZh: '天然白藜蘆醇，200 毫克',
    brand: 'NOW Foods',
    category: 'antioxidant',
    servingSize: '1 capsule',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'LeanFire®',
    nameZh: 'LeanFire®',
    brand: 'Force Factor',
    category: 'pre_workout',
    servingSize: '1 capsule',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Nitric Oxide Booster',
    nameZh: '一氧化氮促進劑',
    brand: 'Nutricost Performance',
    category: 'pre_workout',
    servingSize: '1 capsule',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Standardized Extract Ashwagandha 450 mg',
    nameZh: '南非醉茄，標準化提取物，450 毫克',
    brand: 'NOW Foods',
    category: 'other',
    servingSize: '1 capsule',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Glucosamine Chondroitin MSM',
    nameZh: '葡萄糖胺軟骨素 MSM',
    brand: "Doctor's Best",
    category: 'joint',
    servingSize: '2 tablets',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 2,
  },
  {
    name: 'High Absorption CoQ10',
    nameZh: '高吸收輔酶 Q10',
    brand: "Doctor's Best",
    category: 'antioxidant',
    servingSize: '1 softgel',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Zinc, 50 mg',
    nameZh: '鋅，50 毫克',
    brand: 'NOW Foods',
    category: 'mineral',
    servingSize: '1 tablet',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'High Absorption Magnesium Lysinate Glycinate',
    nameZh: '高吸收賴氨酸甘氨酸鎂，螯合型，Albion® TRAACS®',
    brand: "Doctor's Best",
    category: 'mineral',
    servingSize: '2 tablets',
    timeOfDay: 'evening',
    source: 'iHerb',
    dailyDose: 2,
  },
  {
    name: 'Fundamentals Black Maca',
    nameZh: 'Fundamentals，黑瑪卡',
    brand: 'Force Factor',
    category: 'other',
    servingSize: '1 capsule',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Double Strength Taurine 1000 mg',
    nameZh: '牛磺酸，1000 毫克',
    brand: "Doctor's Best",
    category: 'other',
    servingSize: '1 capsule',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Complete Omega, 100% Wild Alaskan Salmon Oil, 1,300 mg',
    nameZh: 'Complete Omega，全野生阿拉斯加鮭魚油，1,300 毫克',
    brand: 'Natural Factors',
    category: 'omega',
    servingSize: '1 softgel',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Pure Creatine Monohydrate, 750 mg',
    nameZh: '一水肌酸，750 毫克',
    brand: 'California Gold Nutrition',
    category: 'protein',
    servingSize: '1 capsule',
    timeOfDay: 'pre_workout',
    source: 'iHerb',
    dailyDose: 1,
  },
  {
    name: 'Vitamin D3 + K2 as MK-7',
    nameZh: '維生素 D3 + K2（MK-7）',
    brand: 'California Gold Nutrition',
    category: 'vitamin',
    servingSize: '1 softgel',
    timeOfDay: 'morning',
    source: 'iHerb',
    dailyDose: 1,
  },
];

async function main() {
  let inserted = 0;
  let skipped = 0;

  for (const s of supplements) {
    // Check if already exists
    const existing = await pool.query(
      `SELECT id FROM supplements WHERE "userId" = $1 AND name = $2 LIMIT 1`,
      [OWNER_USER_ID, s.name]
    );
    if (existing.rows.length > 0) {
      console.log(`  SKIP (exists): ${s.name}`);
      skipped++;
      continue;
    }

    await pool.query(
      `INSERT INTO supplements ("userId", name, brand, category, serving_size, notes, is_active, current_stock, low_stock_threshold, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, $6, true, 0, 30, NOW(), NOW())`,
      [
        OWNER_USER_ID,
        s.name,
        s.brand,
        s.category,
        s.servingSize,
        `中文名稱: ${s.nameZh}${s.source ? ` | 購買來源: ${s.source}` : ''}${s.dailyDose ? ` | 每日份量: ${s.dailyDose}粒` : ''}`,
      ]
    );
    console.log(`  INSERT: ${s.name}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} inserted, ${skipped} skipped.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
