const aiService = require('./aiService');
const Story = require('../models/Story');

class BookService {
  /**
   * Turn a story into stitched prose using free-first aiDirector routing
   */
  async bookify(storyId, userToken) {
    const story = await Story.findById(storyId);
    if (!story) throw new Error('Story not found');

    // Simple scene chunking: group every N events (dialogue+narrative) into a scene
    const events = story.events || [];
    const chunkSize = 6;
    const scenes = [];
    for (let i = 0; i < events.length; i += chunkSize) {
      scenes.push(events.slice(i, i + chunkSize));
    }

    const factsForScene = (scene) => {
      return `Facts to preserve:\n- Title: ${story.title}\n- Genre: ${story.genre}\n- Do NOT change outcomes.\n- Only polish prose, add transitions, unify tense/POV.\n- No new characters, items, or locations.\n`;
    };

    const rewrittenScenes = [];
    for (const scene of scenes) {
      // Pre-clean: remove repeated plain-title lines to reduce drift
      const sceneText = scene.map(e => e.description).join('\n\n')
        .split('\n')
        .filter(line => line.trim().toLowerCase() !== (story.title || '').trim().toLowerCase())
        .join('\n');

      const prompt = `Act as a copy editor. Perform a LIGHT polish of the text to make it read like a novel chapter, but DO NOT change the story.\n${factsForScene(scene)}\nEDITING RULES (STRICT):\n- Preserve sequence and meaning exactly; keep events and outcomes identical.\n- Keep character names, genders, and roles exactly as in source; do not invent or swap identity.\n- Preserve who is acting/speaking; do not reassign actions or dialogue.\n- Remove meta/game narration (e.g., "Player chose B", command prompts, tooltips).\n- Smooth conversational/imperative phrasing into narrative prose with minimal paraphrase.\n- Enforce one viewpoint for the scene; if the source mixes POV, pick the dominant POV and keep it consistent.\n- Keep the tense consistent with the dominant tense in the source (prefer past).\n- Keep pronouns as in source for each character; do NOT switch between she/he/they for the same person.\n- No new plot details, abilities, locations, technology, or inner thoughts not present in source.\n- Keep length similar (±10%); do not expand with new content.\n\nSOURCE:\n---\n${sceneText}\n---\n\nReturn only the minimally edited prose.`;

      // Ask aiDirector for cheapest recommendation
      const content = await aiService.callBaseGeekAI(prompt, {
        maxTokens: 1400,
        temperature: 0.65,
        appName: 'storyGeek-bookify'
      }, userToken);

      rewrittenScenes.push(content);
    }

    // Simple chapter stitching: join scenes with double line breaks
    let stitched = rewrittenScenes.join('\n\n');

    // Consistency fix pass: enforce POV/tense/pronoun/name consistency across the chapter
    try {
      const fixPrompt = `You are an editor fixing consistency in a chapter draft.\nTasks (STRICT, NO STORY CHANGES):\n1) Keep the same sequence of sentences/events; do not add, remove, or reorder events.\n2) Enforce a single consistent POV and tense; do not change who the scene follows.\n3) Ensure each character's name and pronouns stay exactly as used in the source (no gender/pronoun drift).\n4) Remove any residual meta-game language (choices, commands, tooltips).\n5) Do not invent new lines, thoughts, or descriptions.\nReturn only the corrected chapter text.\n\nSOURCE DRAFT:\n---\n${stitched}\n---`;
      const rec2 = await aiService.recommendProviderModel('consistency fix 1500-2500 tokens', 'cost', {}, userToken);
      const fixed = await aiService.callBaseGeekAI(fixPrompt, {
        provider: rec2.provider,
        model: rec2.model,
        maxTokens: 1800,
        temperature: 0.4,
        appName: 'storyGeek-bookify'
      }, userToken);
      if (fixed && typeof fixed === 'string' && fixed.length > 0) {
        stitched = fixed;
      }
    } catch (_) {
      // keep original stitched if fix fails
    }

    return {
      title: story.title,
      genre: story.genre,
      content: stitched
    };
  }
}

module.exports = new BookService();


