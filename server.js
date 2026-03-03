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

NO REPETITION RULES — enforce strictly:
- If a concept (scale fluctuations, protein importance, fat for hormone support, deload necessity) has already been explained in full, reference it briefly in subsequent sections — do not re-explain it.
- Scale fluctuation education and 7-day rolling average methodology: explain in detail ONCE under Weekly Adjustment Engine only. In Progress Monitoring, summarize as: "Track daily weight and use 7-day rolling average for decisions (see Weekly Adjustment Engine)."
- Client identity data (age, occupation, baseline stats): state once in Personal Snapshot. Do not restate repeatedly.
- Injury guidance: consolidate entirely in INJURY MODIFICATION PROTOCOL. If no injury is specified by the client, omit injury references and disclaimers from all other sections entirely.
- Hormone/testosterone optimization: include only if the client has provided lab data or specific hormonal symptoms. If not provided, omit completely.

FIXED PROTOCOLS — use these exact values everywhere, no variation:
- Deload: reduce sets by 30-40%, reduce load by 10%, maintain training frequency, stop 2-3 reps short of failure. Do not use different percentages in different sections.
- Conditioning / steps: if fat loss stalls, increase daily steps by 1,000. Maximum ceiling: 12,000 steps/day. Use these exact numbers everywhere — do not vary them.
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

    const part1Prompt = prompt + "\n\nWrite ONLY these 3 sections — be thorough. Use the heading text EXACTLY as written:\n## YOUR PERSONAL SNAPSHOT\n## YOUR DAILY CALORIE & MACRO TARGETS\n## YOUR WEEKLY WORKOUT PLAN";
    const part2Prompt = prompt + "\n\nWrite ONLY these 3 sections — be thorough. Use the heading text EXACTLY as written:\n## EXERCISE NOTES & TECHNIQUE TIPS\n## INJURY MODIFICATION PROTOCOL\n## YOUR NUTRITION STRATEGY\n\nFor INJURY MODIFICATION PROTOCOL: consolidate ALL injury, physical limitation, and modification guidance here. Cover what to avoid entirely, exercise substitutions, warm-up requirements for affected areas, and ongoing care. All other sections must be written as if the client has no injuries — this section handles it all.";
    const part3Prompt = prompt + "\n\nWrite ONLY these 3 sections — be thorough. Use the heading text EXACTLY as written:\n## SUPPLEMENT RECOMMENDATIONS\n## RECOVERY & LIFESTYLE OPTIMIZATION\n## WEEKLY CHECK-IN & ADJUSTMENT ENGINE\n\nFor WEEKLY CHECK-IN & ADJUSTMENT ENGINE: include daily weigh-in protocol, 7-day rolling average as the sole decision metric, and these exact decision rules — if average weekly loss >1.5 lbs: increase calories by 100 (carbs first). If loss <0.5 lb for 2 consecutive weeks: decrease carbs by 20g. If strength drops on 2+ major lifts for 2 weeks: add 1 refeed day at maintenance calories (carbs only increase) — name the specific indicator lifts by name using the INDICATOR LIFTS CONSISTENCY RULE defined above. If energy crashes for 7+ days: increase carbs 15-25g. If recovery markers decline: insert deload week early. Adjust only after 2 consecutive weeks of trend confirmation. Language must be systematic and data-driven — not motivational.";
    const part4Prompt = prompt + "\n\nWrite ONLY these 7 sections — be concise but complete. Use the heading text EXACTLY as written:\n## PROGRESS MONITORING PROTOCOL\n## DELOAD PROTOCOL\n## CONDITIONING PROGRESSION\n## POST-CUT TRANSITION PHASE\n## YOUR 4-WEEK PROGRESSION PLAN\n## THE 3 HABITS TO BUILD FIRST\n## REALISTIC EXPECTATIONS\n\nFor PROGRESS MONITORING PROTOCOL: daily weigh-ins upon waking, record Sunday weekly average, waist measurement every 2 weeks at navel relaxed, progress photos every 4 weeks same pose and lighting, name the exact 4 indicator lifts to track using the INDICATOR LIFTS CONSISTENCY RULE defined above — these must match the same 4 exercises named in WEEKLY CHECK-IN & ADJUSTMENT ENGINE. Clarify scale fluctuations are normal due to water and glycogen.\nFor DELOAD PROTOCOL: implement at week 6 or when recovery declines, reduce total volume by 25%, reduce load by 10%, stop 3 reps short of failure on all sets, maintain steps and nutrition unchanged. Note this protects joints and CNS — especially important for 50+ trainees.\nFor CONDITIONING PROGRESSION: use client's current step baseline, threshold for increasing steps if fat loss stalls, maximum step ceiling during a cut, optional incline walk protocol 2-3x weekly. Clarify cardio supports the deficit but does not replace macro compliance.\nFor POST-CUT TRANSITION PHASE: once goal weight is reached, increase calories by 100 per week adding carbs first, maintain protein target, maintain training intensity, continue daily weigh averages, stop increasing once weekly average stabilizes for 2 consecutive weeks. Clarify this protocol prevents rapid fat regain.";

    console.log("Generating plan in 4 parallel parts...");
    const [part1, part2, part3, part4] = await Promise.all([
      callAnthropic(part1Prompt, "[Part1]"),
      callAnthropic(part2Prompt, "[Part2]"),
      callAnthropic(part3Prompt, "[Part3]"),
      callAnthropic(part4Prompt, "[Part4]")
    ]);

    const fullPlan = part1 + "\n\n---\n\n" + part2 + "\n\n---\n\n" + part3 + "\n\n---\n\n" + part4;
    console.log("Plan complete, total length:", fullPlan.length);

    res.json({ success: true, plan: fullPlan });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/validate-code", async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ valid: false, error: "No code provided" });

  const upperCode = code.toUpperCase().trim();
  const freeCodes = (process.env.PROMO_CODES_FREE || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
  const discCodes = (process.env.PROMO_CODES_DISC || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
  const usedCodes = (process.env.USED_CODES || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean);

  if (usedCodes.includes(upperCode)) return res.json({ valid: false, error: "This code has already been used." });
  if (freeCodes.includes(upperCode)) return res.json({ valid: true, type: "free", message: "Free access granted!" });
  if (discCodes.includes(upperCode)) return res.json({ valid: true, type: "discount", message: "15% discount applied!", redirectUrl: process.env.STRIPE_COUPON_URL || "" });

  return res.json({ valid: false, error: "Invalid promo code." });
});

app.get("/", (req, res) => {
  res.json({ status: "Tempered Body API is running" });
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
