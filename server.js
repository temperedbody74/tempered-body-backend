bash

cat /home/claude/tempered-body-backend/server.js
Output

const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// ── GENERATE PLAN ──────────────────────────────────────
app.post("/generate-plan", async (req, res) => {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ success: false, error: "API key not configured" });
  }

  try {
    const { prompt } = req.body;

    const systemMsg = `You are an expert personal trainer and nutrition coach. Create complete, personalized fitness plans.
CRITICAL FORMATTING RULES:
- Use ## for main sections, ### for subsections
- Be specific with real numbers but CONCISE — no repetition, no filler
- Complete ALL sections fully — do not cut off`;

    const callAnthropic = async (userMsg) => {
      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ANTHROPIC_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-5",
          max_tokens: 3000,
          system: systemMsg,
          messages: [{ role: "user", content: userMsg }]
        })
      });
      const data = await response.json();
      if (data.error) throw new Error(data.error.message);
      return data.content?.[0]?.text || "";
    };

    const part1Prompt = prompt + `\n\nWrite ONLY these sections — complete and specific:\n## YOUR PERSONAL SNAPSHOT\n## YOUR DAILY CALORIE & MACRO TARGETS\n## YOUR WEEKLY WORKOUT PLAN\n## EXERCISE TECHNIQUE TIPS`;
    const part2Prompt = prompt + `\n\nWrite ONLY these sections — complete and specific:\n## YOUR NUTRITION STRATEGY\n## SUPPLEMENT RECOMMENDATIONS\n## RECOVERY & LIFESTYLE\n## YOUR 4-WEEK PROGRESSION PLAN\n## TOP 3 HABITS TO BUILD FIRST\n## REALISTIC EXPECTATIONS`;

    console.log("Generating plan — running both parts in parallel...");
    const [part1, part2] = await Promise.all([
      callAnthropic(part1Prompt),
      callAnthropic(part2Prompt)
    ]);

    const fullPlan = part1 + "\n\n---\n\n" + part2;
    console.log("Plan complete, length:", fullPlan.length);

    res.json({ success: true, plan: fullPlan });

  } catch (error) {
    console.error("Generate plan error:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ── VALIDATE PROMO CODE ────────────────────────────────
app.post("/validate-code", async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({ valid: false, error: "No code provided" });
  }

  const upperCode = code.toUpperCase().trim();
  const freeCodes = (process.env.PROMO_CODES_FREE || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
  const discCodes = (process.env.PROMO_CODES_DISC || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean);
  const usedCodes = (process.env.USED_CODES || "").split(",").map(c => c.trim().toUpperCase()).filter(Boolean);

  if (usedCodes.includes(upperCode)) {
    return res.json({ valid: false, error: "This code has already been used." });
  }

  if (freeCodes.includes(upperCode)) {
    return res.json({ valid: true, type: "free", message: "Free access granted!" });
  }

  if (discCodes.includes(upperCode)) {
    const discountUrl = process.env.STRIPE_COUPON_URL || "";
    return res.json({ valid: true, type: "discount", message: "15% discount applied!", redirectUrl: discountUrl });
  }

  return res.json({ valid: false, error: "Invalid promo code." });
});

// ── HEALTH CHECK ───────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "Tempered Body API is running" });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
