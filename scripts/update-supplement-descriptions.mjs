import pg from 'pg';
import { readFileSync } from 'fs';

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.SUPABASE_DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const OWNER_USER_ID = 2;

// Map of supplement name → scraped data
const data = [
  {
    name: 'Water Out™',
    description: "NOW® Water Out™ is a blend of complementary herbs and nutrients formulated to support healthy urinary tract function and proper bodily fluid balance. It features dandelion, traditionally used for water equilibrium, along with uva ursi and juniper, historically used to support a healthy urinary tract. This formula, combined with vitamin B-6 and potassium, helps maintain proper urinary tract function.",
    description_zh: "NOW® Water Out™ 是一種混合了草本植物和營養素的配方，旨在支持健康的泌尿道功能和適當的身體液體平衡。它含有傳統上用於維持水平衡的蒲公英，以及歷史上草藥師用於支持健康泌尿道的熊果和杜松。此配方結合維生素B-6和鉀，有助於維持適當的泌尿道功能。",
    iherb_url: "https://www.iherb.com/pr/now-foods-water-out-100-veg-capsules/15373",
    daily_dose: 2,
    time_of_day: 'pre_workout',
  },
  {
    name: 'Silymarin Complex with Milk Thistle Extract plus Dandelion, Artichoke, Ginger and BioPerine®',
    description: "California Gold Nutrition Silymarin Complex supports liver health by filtering blood and removing waste. It features Milk Thistle Extract (Silymarin) for antioxidant properties and detoxification, combined with Dandelion and Artichoke to encourage bile flow for fat digestion. Turmeric provides additional antioxidant support, and BioPerine® (black pepper extract) enhances the absorption of these beneficial compounds.",
    description_zh: "California Gold Nutrition 水飛薊複合精華透過過濾血液和清除廢物來支持肝臟健康。它含有水飛薊萃取物（水飛薊素），具有抗氧化和排毒功效，並結合蒲公英和朝鮮薊來促進膽汁流動以幫助脂肪消化。薑黃提供額外的抗氧化支持，而 BioPerine®（黑胡椒萃取物）則能增強這些有益成分的吸收。",
    iherb_url: "https://www.iherb.com/pr/california-gold-nutrition-silymarin-complex-with-milk-thistle-extract-plus-dandelion-artichoke-ginger-and-bioperine-360-veggie-capsules/90185",
    daily_dose: 1,
    time_of_day: 'post_workout',
  },
  {
    name: 'Astaxanthin, Astalif® Pure Icelandic, 12 mg',
    description: "California Gold Nutrition Astaxanthin features premium Astalif® Pure Icelandic algae, extracted using solvent-free supercritical CO2 technology. This powerful antioxidant, sourced from Haematococcus pluvialis, supports brain, eye, skin, heart, and joint health. It acts as a lipid-soluble antioxidant, protecting cells and tissues from oxidative stress.",
    description_zh: "California Gold Nutrition 蝦青素採用優質 Astalif® 冰島純藻，透過無溶劑超臨界二氧化碳技術萃取。這種強效抗氧化劑源自雨生紅球藻，有助於支持大腦、眼睛、皮膚、心臟和關節健康。它作為脂溶性抗氧化劑，保護細胞和組織免受氧化壓力。",
    iherb_url: "https://www.iherb.com/pr/california-gold-nutrition-astaxanthin-astalif-pure-icelandic-12-mg-120-veggie-softgels/71684",
    daily_dose: 1,
    time_of_day: 'post_workout',
  },
  {
    name: 'NMN, 175 mg',
    description: "California Gold Nutrition NMN 175 mg supports cellular energy production and healthy aging. This supplement contains β-Nicotinamide Mononucleotide (NMN), a precursor to NAD+, which naturally declines with age. By increasing NAD+ levels, NMN helps promote vitality and cellular signaling.",
    description_zh: "California Gold Nutrition NMN 175 毫克支持細胞能量產生和健康老化。這種補充劑含有 β-煙酰胺單核苷酸 (NMN)，它是 NAD+ 的前體，NAD+ 隨著年齡增長而自然下降。通過增加 NAD+ 水平，NMN 有助於促進活力和細胞信號傳導。",
    iherb_url: "https://www.iherb.com/pr/california-gold-nutrition-nmn-175-mg-60-veggie-capsules/104104",
    daily_dose: 2,
    time_of_day: 'pre_workout',
  },
  {
    name: 'Testosterone Booster',
    description: "Six Star® Testosterone Booster is formulated with a key ingredient shown to amplify your body's testosterone production within the normal range. It contains a precise dose of the mineral boron, which is shown to increase active (free) testosterone in just 7 days. This supplement also includes a unique, plant-based blend that helps maintain peak testosterone-to-cortisol ratio after intense exercise, supporting training performance by protecting against fatigue.",
    description_zh: "Six Star® 睪固酮促進劑含有經證實能提升體內睪固酮至正常範圍內的關鍵成分。它含有精確劑量的礦物質硼，經研究顯示可在短短7天內增加活性（游離）睪固酮。此補充劑還包含獨特的植物性混合物，有助於在劇烈運動後維持最佳睪固酮與皮質醇比例，透過保護身體免受疲勞來支持訓練表現。",
    iherb_url: "https://www.iherb.com/pr/sixstar-testosterone-booster-60-caplets/54772",
    daily_dose: 1,
    time_of_day: 'pre_workout',
  },
  {
    name: "Men's Active Sport Multi",
    description: "NOW® Sports Men's Active Sports Multi is a daily multivitamin for active men, supporting energy metabolism, nutrient repletion, and general wellness. It features high-quality ingredients like free-form amino acids, tribulus, MCT oil, herbal extracts such as Panax ginseng and green tea, along with essential vitamins and minerals. This formula is designed to support all levels of athletes.",
    description_zh: "NOW® Sports 男士運動綜合維生素是一款專為活躍男士設計的日常綜合維生素，支持能量代謝、營養補充和整體健康。它含有高品質成分，如游離形式氨基酸、蒺藜、MCT 油、人參和綠茶等草本提取物，以及必需的維生素和礦物質。此配方旨在支持各級運動員。",
    iherb_url: "https://www.iherb.com/pr/now-foods-sports-men-s-active-sports-multi-180-softgels/49050",
    daily_dose: 2,
    time_of_day: 'morning',
  },
  {
    name: 'LactoBif® 100 Probiotics, 100 Billion CFU',
    description: "California Gold Nutrition LactoBif® 100 Probiotics deliver 100 billion CFU from 8 active probiotic strains, including 5 Lactobacilli and 3 Bifidobacteria. This blend helps maintain a balanced gut microbiome, promoting digestive and immune health. Key strains like Lactobacillus acidophilus and Bifidobacterium longum contribute to a healthy gut environment and may help alleviate digestive concerns such as bloating, gas, and constipation.",
    description_zh: "California Gold Nutrition LactoBif® 100 益生菌提供 1000 億 CFU，含有 8 種活性益生菌菌株，包括 5 種乳酸桿菌和 3 種雙歧桿菌。這種混合物有助於維持腸道微生物群的平衡，促進消化和免疫健康。嗜酸乳桿菌和長雙歧桿菌等關鍵菌株有助於健康的腸道環境，並可緩解腹脹、脹氣和便秘等消化問題。",
    iherb_url: "https://www.iherb.com/pr/california-gold-nutrition-lactobif-100-probiotics-100-billion-cfu-30-veggie-capsules/69435",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Resveratrol, 200 mg',
    description: "Resveratrol, a polyphenol from red grapes and other plants, supports healthy cardiovascular function and offers cellular anti-aging properties. It promotes a healthy response to biological stress through its antioxidant action. This formula includes Trans-resveratrol, which modulates cellular signaling pathways, and Grape Seed Extract, providing oligomeric proanthocyanidins for antioxidant support and healthy blood vessel integrity.",
    description_zh: "白藜蘆醇是一種天然存在於紅葡萄皮和其他植物中的多酚，有助於支持心血管健康並具有細胞抗衰老特性。它通過其抗氧化作用促進對生物壓力的健康反應。此配方包含反式白藜蘆醇，可調節細胞信號通路，以及葡萄籽提取物，提供低聚原花青素以支持抗氧化和健康的血管完整性。",
    iherb_url: "https://www.iherb.com/pr/now-foods-resveratrol-200-mg-120-veg-capsules/16093",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'LeanFire®',
    description: "LeanFire® with Next-Gen Slimvance® is a powerful fat burner designed to support weight management and boost energy. This innovative formula features Slimvance® for significant weight reduction, along with an Unreal Energy™ Matrix containing infinergy™ and zumXR® for sustained energy. It also includes thermogenic compounds like TEACRINE®, yohimbine, CAPSIMAX®, and BIOPERINE® to ignite metabolism and enhance fat burning.",
    description_zh: "LeanFire® with Next-Gen Slimvance® 是一款強效的脂肪燃燒劑，旨在支持體重管理並提升能量。這款創新配方含有 Slimvance® 以實現顯著的減重效果，並結合 Unreal Energy™ Matrix，其中包含 infinergy™ 和 zumXR®，提供持久的能量。它還包括 TEACRINE®、育亨賓、CAPSIMAX® 和 BIOPERINE® 等生熱化合物，以促進新陳代謝並增強脂肪燃燒。",
    iherb_url: "https://www.iherb.com/pr/force-factor-leanfire-with-next-gen-slimvance-60-vegetable-capsules/116027",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Nitric Oxide Booster',
    description: "Nutricost Performance Nitric Oxide Booster supports exercise performance, circulation, and workout pumps. It features a blend of L-Arginine, L-Arginine HCl, Arginine Alpha-Ketoglutarate, L-Citrulline, and L-Citrulline Malate. These ingredients work together to provide immediate and sustained nitric oxide production, helping to relax blood vessels and support healthy circulation and energy metabolism during exercise.",
    description_zh: "Nutricost Performance 一氧化氮促進劑有助於提升運動表現、促進血液循環並增強肌肉充血感。它含有 L-精氨酸、L-精氨酸鹽酸鹽、精氨酸 α-酮戊二酸、L-瓜氨酸和 L-瓜氨酸蘋果酸的混合配方。這些成分協同作用，提供即時且持久的一氧化氮生成，幫助放鬆血管，並在運動期間支持健康的血液循環與能量代謝。",
    iherb_url: "https://www.iherb.com/pr/nutricost-performance-nitric-oxide-booster-90-capsules/145349",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Standardized Extract Ashwagandha 450 mg',
    description: "Ashwagandha (Withania somnifera) is an herb extensively used in Ayurveda, the traditional herbal system in India. It acts as a general tonic and adaptogen, helping the body adapt to temporary, normal stress. Preliminary data also suggest that ashwagandha supports a healthy immune system and helps maintain mind-body balance.",
    description_zh: "南非醉茄（Withania somnifera）是印度阿育吠陀傳統草藥系統中廣泛使用的草藥。它作為一種全面補品和適應原，有助於身體適應暫時的正常壓力，並改善壓力情緒。初步數據還表明，南非醉茄支持健康的免疫系統，並有助於維持身心平衡。",
    iherb_url: "https://www.iherb.com/pr/now-foods-standardized-extract-ashwagandha-450-mg-180-veg-capsules/78203",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Glucosamine Chondroitin MSM',
    description: "Doctor's Best Glucosamine Chondroitin MSM is a dietary supplement designed to provide comprehensive support for joint health, mobility, and comfort. Its formula combines glucosamine to support joint mobility, chondroitin to enhance joint comfort, and MSM to supply bioavailable sulfur for connective tissue integrity. Additionally, this blend promotes healthy hair, skin, and nails.",
    description_zh: "Doctor's Best 葡萄糖胺軟骨素 MSM 是一種膳食補充劑，旨在為關節健康、活動能力和舒適度提供全面支持。其配方結合了支持關節活動的葡萄糖胺、增強關節舒適度的軟骨素以及提供生物可利用的硫以保持結締組織完整性的 MSM。此外，這種混合物還能促進頭髮、皮膚和指甲的健康。",
    iherb_url: "https://www.iherb.com/pr/doctor-s-best-glucosamine-chondroitin-msm-with-optimsm-240-veggie-capsules/23",
    daily_dose: 2,
    time_of_day: 'morning',
  },
  {
    name: 'High Absorption CoQ10',
    description: "Doctor's Best High Absorption CoQ10 supports cellular energy production, heart health, and provides antioxidant support. This formula helps restore CoQ10 levels that may be depleted by aging and statin drugs. It is formulated with BioPerine® black pepper extract to enhance absorption and bioavailability, ensuring increased CoQ10 uptake for mitochondrial energy needs.",
    description_zh: "Doctor's Best 高吸收輔酶Q10支持細胞能量產生、心臟健康並提供抗氧化支持。此配方有助於恢復因衰老和他汀類藥物可能耗盡的輔酶Q10水平。它採用BioPerine®黑胡椒提取物配製，以增強吸收和生物利用度，確保輔酶Q10攝取量增加以滿足線粒體能量需求。",
    iherb_url: "https://www.iherb.com/pr/doctor-s-best-high-absorption-coq10-100-mg-120-softgels/10930",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Zinc, 50 mg',
    description: "NOW Foods Zinc 50 mg provides essential immune support and promotes healthy skin. This vital mineral acts as a cofactor for numerous enzymes involved in antioxidant defense, protein synthesis, and cellular metabolism. It plays a critical role in neutralizing free radicals and supporting overall healthy aging.",
    description_zh: "NOW Foods 鋅 50 毫克提供必需的免疫支持並促進健康的皮膚。這種重要的礦物質是許多參與抗氧化防禦、蛋白質合成和細胞代謝的酶的輔助因子。它在中和自由基和支持整體健康老化方面發揮著關鍵作用。",
    iherb_url: "https://www.iherb.com/pr/now-foods-zinc-50-mg-250-tablets/883",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'High Absorption Magnesium Lysinate Glycinate',
    description: "Doctor's Best High Absorption Magnesium Lysinate Glycinate is a specialized magnesium formula that provides essential support for muscles, nerves, sleep quality, and maintaining a balanced mood. It is 100% chelated with Albion® TRAACS® for up to 6x better absorption than other forms of magnesium. This supplement is crucial for various bodily functions, participating in over 600 enzyme systems that support biochemical processes.",
    description_zh: "Doctor's Best 高吸收鎂甘胺酸鹽離胺酸鹽是一種特殊的鎂配方，為肌肉、神經、睡眠品質和維持情緒平衡提供重要支持。它採用 Albion® TRAACS® 100% 螯合，吸收率比其他形式的鎂高達 6 倍。這種補充劑對各種身體機能至關重要，參與 600 多個支持生化過程的酶系統。",
    iherb_url: "https://www.iherb.com/pr/doctor-s-best-high-absorption-magnesium-lysinate-glycinate-chelated-albion-traacs-240-tablets-100-mg-per-tablet/16567",
    daily_dose: 2,
    time_of_day: 'evening',
  },
  {
    name: 'Fundamentals Black Maca',
    description: "Force Factor Fundamentals Black Maca is a dietary supplement designed to enhance sexual wellness, energy, and provide antioxidant and thyroid support. It features 1000 mg of black maca root extract, known for influencing the hypothalamic–pituitary axis to support healthy energy, mood, and sexual drive. The formula also includes selenium for antioxidant activity and BioPerine Black Pepper Fruit Extract to enhance nutrient absorption.",
    description_zh: "Force Factor Fundamentals Black Maca 是一種膳食補充劑，旨在增強性健康、能量，並提供抗氧化和甲狀腺支持。它含有 1000 毫克黑瑪卡根提取物，已知可影響下丘腦-垂體軸，以支持健康的能量、情緒和性慾。該配方還包括用於抗氧化活性的硒，以及 BioPerine 黑胡椒果提取物，以增強營養吸收。",
    iherb_url: "https://www.iherb.com/pr/force-factor-fundamentals-black-maca-90-capsules/128405",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Double Strength Taurine 1000 mg',
    description: "Doctor's Best Double Strength Taurine 1000 mg supports cardiovascular health, nerve function, and eye health. This amino acid plays a vital role in maintaining cellular fluid balance and acts as a calming neurotransmitter. It also aids in bile acid conjugation for healthy digestion and provides antioxidant protection for cells.",
    description_zh: "Doctor's Best 雙倍強效牛磺酸 1000 毫克支持心血管健康、神經功能和眼睛健康。這種氨基酸在維持細胞液體平衡中起著至關重要的作用，並作為一種鎮靜神經遞質。它還有助於膽汁酸結合，促進健康消化，並為細胞提供抗氧化保護。",
    iherb_url: "https://www.iherb.com/pr/doctor-s-best-double-strength-taurine-1000-mg-90-veggie-capsules/15714",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Complete Omega, 100% Wild Alaskan Salmon Oil, 1,300 mg',
    description: "Natural Factors Complete Omega Wild Alaskan Salmon Oil provides a comprehensive blend of omega-3, 5, 6, 7, 8, 9, and 11 fatty acids, including EPA and DHA, along with naturally occurring Astaxanthin and Vitamin D3. This sustainably sourced supplement supports cardiovascular health, cognitive function, brain health, and overall wellness. It helps maintain healthy serum triglycerides and offers antioxidant protection.",
    description_zh: "Natural Factors Complete Omega 野生阿拉斯加鮭魚油提供全面的 Omega-3、5、6、7、8、9 和 11 脂肪酸混合物，包括 EPA 和 DHA，以及天然存在的蝦紅素和維生素 D3。這種可持續來源的補充劑可支持心血管健康、認知功能、大腦健康和整體健康。它有助於維持健康的血清三酸甘油酯並提供抗氧化保護。",
    iherb_url: "https://www.iherb.com/pr/natural-factors-complete-omega-100-wild-alaskan-salmon-oil-1-300-mg-180-enteripure-softgels/105598",
    daily_dose: 1,
    time_of_day: 'morning',
  },
  {
    name: 'Pure Creatine Monohydrate, 750 mg',
    description: "California Gold Nutrition Sport Pure Creatine Monohydrate provides 750mg of creatine monohydrate per capsule. This supplement is designed to support exercise performance, power output, and lean muscle mass. Creatine helps increase phosphocreatine stores in muscles, aiding in ATP regeneration during high-intensity efforts and reducing muscle fatigue.",
    description_zh: "California Gold Nutrition 運動型純肌酸單水化合物每粒膠囊含有 750 毫克肌酸單水化合物。本補充劑旨在支持運動表現、力量輸出和瘦肌肉量。肌酸有助於增加肌肉中的磷酸肌酸儲存，在高強度運動期間協助三磷酸腺苷再生並減少肌肉疲勞。",
    iherb_url: "https://www.iherb.com/pr/california-gold-nutrition-sport-pure-creatine-monohydrate-750-mg-240-veggie-capsules/120573",
    daily_dose: 1,
    time_of_day: 'pre_workout',
  },
  {
    name: 'Vitamin D3 + K2 as MK-7',
    description: "California Gold Nutrition Vitamin D3 + K2 as MK-7 is a synergistic formula designed to support bone and cardiovascular health. It features a blend of Vitamin D3 (cholecalciferol) and Vitamin K2 (menaquinone-7, MK-7). Vitamin D3 aids in calcium absorption, while Vitamin K2 helps direct calcium to bones and away from soft tissues, ensuring proper calcium utilization.",
    description_zh: "California Gold Nutrition 維生素 D3 + K2 MK-7 是一種協同配方，旨在支持骨骼和心血管健康。它含有維生素 D3（膽鈣化醇）和維生素 K2（甲萘醌-7，MK-7）的混合物。維生素 D3 有助於鈣的吸收，而維生素 K2 有助於將鈣引導至骨骼並遠離軟組織，確保鈣的適當利用。",
    iherb_url: "https://www.iherb.com/pr/california-gold-nutrition-vitamin-d3-k2-as-mk-7-180-veggie-capsules/124745",
    daily_dose: 1,
    time_of_day: 'morning',
  },
];

async function main() {
  let updated = 0;
  for (const s of data) {
    const result = await pool.query(
      `UPDATE supplements SET description=$1, description_zh=$2, iherb_url=$3, daily_dose=$4, time_of_day=$5, "updatedAt"=NOW()
       WHERE "userId"=$6 AND name=$7 RETURNING id`,
      [s.description, s.description_zh, s.iherb_url, s.daily_dose, s.time_of_day, OWNER_USER_ID, s.name]
    );
    if (result.rowCount > 0) {
      console.log(`  UPDATED (id=${result.rows[0].id}): ${s.name}`);
      updated++;
    } else {
      console.log(`  NOT FOUND: ${s.name}`);
    }
  }
  console.log(`\nDone: ${updated} records updated.`);
  await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
