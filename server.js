const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

const PORT = process.env.PORT || 3000;

app.post("/generate-plan", async (req, res) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, error: "API key not configured" });
  }

  try {
    const { prompt } = req.body;

    const systemMsg = `You are producing a structured performance manual for a paying client. Write with clarity, precision, and authority. This is not a motivational article — it is a data-driven operational document.

TONE & STYLE:
- Direct, technical, and actionable. No filler language, no emotional persuasion.
- Do not use phrases like "You've proven", "You have what it takes", or any similar motivational clichés.
- Each section provides new information only. Do not repeat what has already been stated elsewhere in the document.

SECTION HEADINGS:
- Use EXACTLY the ## headings specified in the prompt. Do not rename, reorder, combine, or add sections.
- Start your response directly with the first ## heading. No preamble, no intro sentence before the first ##.
- Use plain text only — no emoji, no special symbols. Use - for bullet points.

SECTION OWNERSHIP — each concept belongs to one section. All other sections reference it by name only, never re-explain it:
- Scale fluctuation education and 7-day rolling average methodology: owned by WEEKLY CHECK-IN & ADJUSTMENT ENGINE.
- Deload mechanics and protocol details: owned by DELOAD PROTOCOL.
- Cardio interval protocol (incline/speed/duration): owned by YOUR WEEKLY WORKOUT PLAN.
- Step count progression and conditioning targets: owned by CONDITIONING PROGRESSION.
- Calorie and macro targets and the math behind them: owned by YOUR DAILY CALORIE & MACRO TARGETS.
- Injury modifications and substitutions: owned by INJURY MODIFICATION PROTOCOL. Omit injury references from all other sections entirely if no injury is specified.
- Week-by-week load and volume progression: owned by YOUR 4-WEEK PROGRESSION PLAN.
- Post-cut reverse diet protocol: owned by POST-CUT TRANSITION PHASE.
- Supplement dosing and recommendations: owned by SUPPLEMENT RECOMMENDATIONS.
- Client identity data (age, stats, occupation): state once in YOUR PERSONAL SNAPSHOT only.
- Hormone/testosterone optimization: include only if the client provided lab data or specific hormonal symptoms. If not provided, omit completely from all sections.

FIXED PROTOCOLS — use these exact values everywhere, no variation:
- Deload: reduce total sets by 30%, reduce load by 10%, stop 2-3 reps short of failure on all sets, maintain training frequency, maintain steps and nutrition unchanged.
- Conditioning / steps: if fat loss stalls, increase daily steps by 1,000. Maximum ceiling: 12,000 steps/day.
- Weekly Adjustment Engine must always include this exact statement: "Only adjust one variable at a time. Do not modify calories, conditioning volume, and refeeds simultaneously."

INDICATOR LIFTS:
- Define 4 indicator lifts once based on the client's program. Use these exact same 4 exercises by name in every section that references tracking lifts, strength benchmarks, or adjustment triggers. Never name different exercises in different sections.`;

    const callAnthropic = async (userMsg, label = "") => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          let fullText = "";
          let messages = [{ role: "user", content: userMsg }];
          let truncated = true;
          let continuations = 0;
          const MAX_CONTINUATIONS = 3;

          while (truncated && continuations <= MAX_CONTINUATIONS) {
            const response = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01"
              },
              body: JSON.stringify({
                model: "claude-sonnet-4-5",
                max_tokens: 8000,
                system: systemMsg,
                messages
              })
            });
            const data = await response.json();
            if (data.error) throw new Error(data.error.message);

            const chunk = data.content?.[0]?.text || "";
            fullText += chunk;
            truncated = data.stop_reason === "max_tokens";

            if (truncated) {
              continuations++;
              console.warn(`${label} hit max_tokens (continuation ${continuations}), length so far: ${fullText.length}`);
              messages = [
                { role: "user", content: userMsg },
                { role: "assistant", content: fullText },
                { role: "user", content: "Continue exactly where you left off. Do not repeat anything already written." }
              ];
            }
          }

          if (!fullText) {
            console.warn(`${label} attempt ${attempt} empty — retrying...`);
            if (attempt < 3) { await new Promise(r => setTimeout(r, 1500 * attempt)); continue; }
          }

          console.log(`${label} done — ${continuations} continuation(s), length: ${fullText.length}`);
          return fullText;

        } catch (err) {
          console.error(`${label} attempt ${attempt} threw:`, err.message);
          if (attempt < 3) { await new Promise(r => setTimeout(r, 1500 * attempt)); continue; }
          throw err;
        }
      }
      return "";
    };

    const part1Prompt = prompt + `\n\nWrite ONLY these 3 sections — be thorough and specific. Use the heading text EXACTLY as written:

## YOUR PERSONAL SNAPSHOT
Write 3-4 sentences summarizing who this client is, where they are now, and what success looks like for them. Address them by first name. Be direct and specific — mention their key numbers (age, weight, goal weight, timeline).

## YOUR DAILY CALORIE & MACRO TARGETS
Use the PRE-CALCULATED MACRO TARGETS provided in the client data if present. Confirm these targets are appropriate for the client's goal and explain the reasoning in 2-3 sentences. State daily calories, protein, carbs, and fats as specific numbers.

## YOUR WEEKLY WORKOUT PLAN
Use the client's "Days available" field to select the correct program structure below. Do not default to 5 days if fewer are available.

PROGRAM SELECTION — based on days available per week:

IF 5 DAYS:
DAY 1 — PUSH (Chest, Shoulders, Triceps)
5-6 exercises. Include Squats ONLY if the client has a lower body goal or has indicated extra time available — never default to including them.
DAY 2 — PULL (Back, Biceps)
5-6 exercises. Same optional squats condition as Day 1.
DAY 3 — CARDIO (1 hour, incline-based)
Interval protocol: 2-3 min at elevated incline/effort, then 4 min at lower intensity. Repeat for the full hour. Scale to fitness level (see cardio scaling rules below).
DAY 4 — UPPER BODY
Weeks 1-4: Lower weight, higher reps (12-20). Purpose: build work capacity and reinforce movement patterns before intensity increases. After Week 4: transition to heavier compound focus or lagging muscle emphasis based on their goals.
DAY 5 — CARDIO (1 hour, incline-based)
Same protocol as Day 3. Also serves as active recovery.
REST: 2 full days after Day 5, then repeat from Day 1.

IF 4 DAYS:
DAY 1 — PUSH (Chest, Shoulders, Triceps)
DAY 2 — PULL (Back, Biceps)
DAY 3 — CARDIO (1 hour, incline-based)
DAY 4 — UPPER BODY
REST until next available day, then repeat from Day 1.
Note in the plan: The second cardio day is dropped to fit the schedule — not any of the training days.

IF 3 DAYS:
DAY 1 — PUSH (Chest, Shoulders, Triceps)
DAY 2 — CARDIO (1 hour, incline-based)
DAY 3 — PULL (Back, Biceps)
REST, then repeat.
Note in the plan: The Upper Body day rotates in every other cycle to prevent permanent omission. Also note that adding a 4th day when possible will significantly accelerate their results.

ROTATION RULES (include in the plan for all structures):
- The cycle is day-based, not calendar-based. Days advance in sequence regardless of the day of the week.
- If a day is missed, resume at the NEXT day in the rotation — never repeat or skip a day.
- If more than 2 consecutive days are missed, flag it gently and have them restart at the current day in the cycle.
- Core principle to weave throughout: "Consistency is the key. This program is engineered around one truth — the person who shows up imperfectly every week will always outperform the person who trains perfectly and then disappears. Your only job is to not stop."

BEGINNER PROTOCOL — apply if experience level is "No experience" or "Beginner (under 1 year)":
Week 1: Treadmill walks only. No incline requirement. 30-45 minutes at a comfortable pace. No strength training. Goal is habit formation, not fitness output.
Week 2 onward: Assess their stated fitness level, daily step count, job activity, and sleep to decide progression rate — do not apply a fixed timeline. If Week 1 felt easy, introduce light incline and begin Day 1 of the strength structure at bodyweight or very light load. If Week 1 was a struggle, extend walks one more week before adding strength work.
The program structure days are the same for beginners — exercises, load, and intensity are what scale down. A beginner on Day 1 does the same push day as an advanced user, but with machines or dumbbells at controlled weight, fewer sets, and longer rest periods.

CARDIO SCALING BY FITNESS LEVEL:
Beginner: Treadmill walk, no incline to start. Progress to 2-4% incline by Week 2-3. Speed: 2.5-3.5 mph conversational pace. Interval intensity difference between high and low intervals is small.
Intermediate: Treadmill or elliptical. Incline: 6-10% work / 2-4% rest. Speed: 3.5-4.5 mph or equivalent elliptical resistance. Standard interval: 2-3 min up / 4 min down.
Advanced: Treadmill or elliptical. Incline: 10-15% work / 4-6% rest. Speed: 4.0-5.0 mph or high elliptical resistance. Can compress rest intervals to 3 min as capacity grows.
All levels maintain 1-hour duration. Incline and speed are the variables — not time.

EXERCISE SELECTION BY EQUIPMENT — fully match to what the client has available. Do not list an exercise and note a substitution; fully replace it so the plan contains only exercises they can actually do.
Full gym (barbells, cables, machines): use the full movement library.
Home gym (dumbbells, bench): replace all barbell and cable work with dumbbell equivalents; replace machines with floor or bench variations.
Bodyweight only: push-up variations for push day, inverted rows/band w
