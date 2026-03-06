// AI Oracle — evaluates novel item combinations via Claude Haiku
// Mirrors world-master.js pattern: same API, same error handling, same JSON parsing

import { PROPERTIES } from './materials.js';

export function initOracle(shared) {
  const { loadJSON, saveJSON, broadcast, addWorldNews, awardXP } = shared;

  // Persistent recipe cache — once approved, never call AI again
  const recipes = loadJSON('oracle-recipes.json', {});

  // Rate limiting state
  const agentCooldowns = new Map(); // agentId → timestamp
  const globalCalls = [];           // timestamps of recent calls
  const AGENT_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes — encourage experimentation!
  const MAX_PER_HOUR = 40;
  const MAX_PER_DAY = 100;

  const VALID_TYPES = ['material', 'tool', 'consumable', 'decoration', 'special'];
  const VALID_RARITIES = ['Common', 'Uncommon', 'Rare'];

  function getRecipeKey(force, itemNames) {
    return force + ':' + [...itemNames].sort().join('+');
  }

  function findRecipe(force, itemNames) {
    const key = getRecipeKey(force, itemNames);
    return recipes[key] || null;
  }

  function saveRecipe(force, itemNames, result) {
    const key = getRecipeKey(force, itemNames);
    recipes[key] = {
      result,
      discoveredAt: new Date().toISOString(),
      key,
    };
    saveJSON('oracle-recipes.json', recipes);
  }

  // --- Rate Limiting ---
  function checkRateLimit(agentId) {
    const now = Date.now();

    // Per-agent cooldown
    const lastCall = agentCooldowns.get(agentId) || 0;
    if (now - lastCall < AGENT_COOLDOWN_MS) {
      const remaining = Math.ceil((AGENT_COOLDOWN_MS - (now - lastCall)) / 1000);
      return { allowed: false, reason: `Oracle cooldown: ${remaining}s remaining` };
    }

    // Clean old entries
    const oneHourAgo = now - 3600000;
    const oneDayAgo = now - 86400000;
    while (globalCalls.length > 0 && globalCalls[0] < oneDayAgo) globalCalls.shift();

    // Global hourly limit
    const hourlyCount = globalCalls.filter(t => t > oneHourAgo).length;
    if (hourlyCount >= MAX_PER_HOUR) {
      return { allowed: false, reason: 'The Oracle is resting. Too many consultations this hour.' };
    }

    // Global daily limit
    if (globalCalls.length >= MAX_PER_DAY) {
      return { allowed: false, reason: 'The Oracle has spoken enough for today.' };
    }

    return { allowed: true };
  }

  function recordCall(agentId) {
    agentCooldowns.set(agentId, Date.now());
    globalCalls.push(Date.now());
  }

  // --- Validation ---
  function validateResult(result, inputItems) {
    if (!result || typeof result !== 'object') return { valid: false, reason: 'No result object' };
    if (typeof result.approved !== 'boolean') return { valid: false, reason: 'Missing approved field' };

    if (!result.approved) {
      // Rejection is always valid
      return { valid: true };
    }

    const r = result.result;
    if (!r || typeof r !== 'object') return { valid: false, reason: 'Missing result details' };
    if (!r.name || typeof r.name !== 'string') return { valid: false, reason: 'Missing result name' };
    if (!VALID_TYPES.includes(r.type)) return { valid: false, reason: `Invalid type: ${r.type}` };
    if (!VALID_RARITIES.includes(r.rarity)) return { valid: false, reason: `Invalid rarity: ${r.rarity}` };
    if (!r.description || typeof r.description !== 'string') return { valid: false, reason: 'Missing description' };

    // Validate properties if provided
    if (r.properties && typeof r.properties === 'object') {
      for (const [key, val] of Object.entries(r.properties)) {
        const spec = PROPERTIES[key];
        if (!spec) continue; // ignore unknown properties
        if (typeof val !== 'number' || val < spec.min || val > spec.max) {
          return { valid: false, reason: `Property ${key}=${val} out of range [${spec.min}, ${spec.max}]` };
        }
      }
    }

    // Power budget check: result shouldn't be overpowered compared to inputs
    const powerKeys = ['hardness', 'conductivity', 'energy', 'luminosity', 'resonance', 'sharpness'];
    if (r.properties) {
      const inputPower = inputItems.reduce((sum, item) => {
        const props = item.properties || {};
        return sum + powerKeys.reduce((s, k) => s + (props[k] || 0), 0);
      }, 0);
      const resultPower = powerKeys.reduce((s, k) => s + (r.properties[k] || 0), 0);
      if (resultPower > inputPower * 1.2) {
        return { valid: false, reason: 'Result exceeds power budget' };
      }
    }

    return { valid: true };
  }

  // --- AI Oracle Call ---
  async function consultOracle(agent, force, inputItems, zone) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return { consulted: false, reason: 'No API key configured' };
    }

    // Rate limiting
    const rateCheck = checkRateLimit(agent.id);
    if (!rateCheck.allowed) {
      return { consulted: false, reason: rateCheck.reason };
    }

    // Check cached recipe first (double-check in case caller missed it)
    const itemNames = inputItems.map(i => i.name);
    const cached = findRecipe(force, itemNames);
    if (cached) {
      return { consulted: false, cached: true, recipe: cached };
    }

    const itemDescriptions = inputItems.map(i => {
      const props = i.properties || {};
      return `${i.name} (hardness:${props.hardness||0}, sharpness:${props.sharpness||0}, malleability:${props.malleability||0}, brittleness:${props.brittleness||0}, length:${props.length||0}, flexibility:${props.flexibility||0}, structural:${props.structural||0}, insulation:${props.insulation||0}, flammability:${props.flammability||0}, organic:${props.organic||0}, weight:${props.weight||0}, energy:${props.energy||0})`;
    });

    const systemPrompt = `You are simulating REAL WORLD physics. Think like a survival expert, not a game designer.

Consider what would ACTUALLY happen if a human did this with these materials on a beach, in a forest, or in a cave. You are evaluating whether applying a physical force to these items would produce something useful.

SURVIVAL KNOWLEDGE YOU SHOULD APPLY:
- Flint can be knapped (struck against hard stone) to create sharp cutting edges
- Striking flint against flint or iron-bearing stone creates hot sparks for fire
- Plant fibers (palm fronds, reeds, bark strips) can be twisted/braided into rope
- Branches + large leaves/fronds = simple lean-to shelter
- Stones arranged in a circle = fire pit/containment
- A sharp stone lashed to a long stick = axe, spear, or cutting tool
- Coconuts can be cracked open by impact to yield meat and a bowl-shaped shell
- Clay + heat = hardened pottery
- Wet sand + form + dry = simple molds

FOR TOOLS, CONSIDER:
- Sharpness: Can it cut? (flint is excellent, shells can work)
- Hardness: Will it hold up to use?
- Length: Is it long enough for a handle? A spear shaft?
- Flexibility: Can it be bent into a bow? Woven into rope?
- Structural: Can it bear weight? Support a shelter?

APPROVAL GUIDELINES:
- APPROVE combinations that a real human survivalist would attempt
- APPROVE if the physics makes sense even if the result is crude
- REJECT magic/fantasy combinations (no potions from random herbs, no glowing crystals from mundane items)
- REJECT if there's no physical mechanism for the transformation

You must respond with ONLY valid JSON:
{
  "approved": true/false,
  "result": {
    "name": "Result Item Name",
    "type": "material|tool|consumable|decoration|special",
    "rarity": "Common|Uncommon|Rare",
    "properties": { "hardness": 0-10, "conductivity": 0-10, "flammability": 0-10, "toxicity": 0-10, "luminosity": 0-10, "volatility": 0-10, "organic": 0-1, "weight": 0.1-100, "decay_rate": 0-1, "energy": 0-100, "temperature": -50-500, "resonance": 0-10, "melt_point": 0-2000, "ignition": 0-1000, "sharpness": 0-10, "solubility": 0-10, "malleability": 0-10, "brittleness": 0-10, "fertility": 0-10, "length": 0-10, "flexibility": 0-10, "insulation": 0-10, "structural": 0-10, "absorbency": 0-10 },
    "description": "Short flavor text (1 sentence)"
  },
  "feedback": "Explanation of what happened (1-2 sentences)"
}

Rules:
- Rarity caps at Rare. Never Epic or Legendary.
- Result properties must stay within defined ranges.
- Result cannot be more powerful than the sum of its inputs. Keep it balanced.
- If the combination makes no physical sense, set approved: false and explain in feedback.
- Name should be evocative but grounded (e.g., "Sharp Flint Blade", "Palm Fiber Rope", "Stone Axe").
- When approved is false, result can be null.
- Respond ONLY with the JSON object. No markdown, no explanation.`;

    const userMessage = `Force: ${force}
Zone: ${zone}
Items: ${itemDescriptions.join(', ')}

What happens when ${force} is applied to these items?`;

    try {
      recordCall(agent.id);

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 512,
          system: systemPrompt,
          messages: [{ role: 'user', content: userMessage }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error(`[oracle] API error ${response.status}: ${errText}`);
        return { consulted: true, error: 'Oracle communication failed' };
      }

      const data = await response.json();
      const text = data.content?.[0]?.text;
      if (!text) {
        console.error('[oracle] No text in response');
        return { consulted: true, error: 'Oracle gave no response' };
      }

      // Parse JSON (strip potential markdown fences)
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const oracleResult = JSON.parse(cleaned);

      // Validate
      const validation = validateResult(oracleResult, inputItems);
      if (!validation.valid) {
        console.error(`[oracle] Validation failed: ${validation.reason}`);
        return { consulted: true, error: `Oracle result invalid: ${validation.reason}` };
      }

      // Save approved recipes permanently
      if (oracleResult.approved && oracleResult.result) {
        saveRecipe(force, itemNames, oracleResult.result);
        console.log(`[oracle] New recipe saved: ${force}:${itemNames.join('+')} → ${oracleResult.result.name}`);
      }

      return {
        consulted: true,
        approved: oracleResult.approved,
        result: oracleResult.result || null,
        feedback: oracleResult.feedback || null,
      };
    } catch (err) {
      console.error(`[oracle] Call failed: ${err.message}`);
      return { consulted: true, error: 'Oracle consultation failed' };
    }
  }

  function setupRoutes(app, authAgent) {
    // Oracle recipes (public)
    app.get('/api/oracle/recipes', (req, res) => {
      const list = Object.entries(recipes).map(([key, val]) => ({
        key,
        result: val.result,
        discoveredAt: val.discoveredAt,
      }));
      res.json({ recipes: list, count: list.length });
    });

    // Discovery naming (first discoverer can rename)
    app.post('/api/discovery/name', authAgent, (req, res) => {
      const { recipe_key, new_name } = req.body;
      if (!recipe_key || !new_name || typeof new_name !== 'string') {
        return res.status(400).json({ error: 'recipe_key and new_name required' });
      }
      const sanitized = new_name.replace(/<[^>]*>/g, '').replace(/[<>&"'`]/g, '').trim().slice(0, 40);
      if (sanitized.length < 2) return res.status(400).json({ error: 'Name too short' });

      const recipe = recipes[recipe_key];
      if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

      recipe.result.name = sanitized;
      recipe.namedBy = req.agent.id;
      saveJSON('oracle-recipes.json', recipes);
      res.json({ ok: true, name: sanitized });
    });

    // Oracle stats
    app.get('/api/oracle/stats', (req, res) => {
      const now = Date.now();
      const oneHourAgo = now - 3600000;
      res.json({
        total_recipes: Object.keys(recipes).length,
        calls_this_hour: globalCalls.filter(t => t > oneHourAgo).length,
        calls_today: globalCalls.length,
        max_per_hour: MAX_PER_HOUR,
        max_per_day: MAX_PER_DAY,
      });
    });
  }

  return {
    consultOracle,
    validateResult,
    findRecipe,
    saveRecipe,
    getRecipeKey,
    checkRateLimit,
    setupRoutes,
  };
}
