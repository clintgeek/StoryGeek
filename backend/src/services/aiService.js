const axios = require('axios');

class AIService {
  constructor() {
    this.baseGeekUrl = process.env.BASEGEEK_URL || 'https://basegeek.clintgeek.com';
    this.jwtToken = process.env.BASEGEEK_JWT_TOKEN || '';
    this.sessionStats = {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0
    };
  }

  /**
   * Call the centralized AI service in baseGeek
   */
  async callBaseGeekAI(prompt, config = {}, userToken = null) {
    try {
      // Add app tracking to the config
      const configWithApp = {
        ...config,
        appName: 'storyGeek'
      };

      // Use the user's token if provided, otherwise fall back to app token
      const authToken = userToken || this.jwtToken;

      if (!authToken) {
        throw new Error('No authentication token available');
      }

      const response = await axios.post(`${this.baseGeekUrl}/api/ai/call`, {
        prompt,
        config: configWithApp
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        timeout: 30000
      });

      if (response.data.success) {
        this.updateStats(response.data.data.provider);
        return response.data.data.response;
      } else {
        throw new Error(response.data.error?.message || 'AI call failed');
      }
    } catch (error) {
      console.error('BaseGeek AI call failed:', error.message);
      throw error;
    }
  }

  /**
   * Build context for story AI prompt
   */
  buildContext(story, userInput, diceResult = null) {
    // Handle incomplete story objects (like during story creation)
    const worldState = story.worldState || {};

    // AGGRESSIVE CONTEXT OPTIMIZATION
    // Only include the last 3 events instead of 10
    const recentEvents = (story.events || []).slice(-3);
    console.log('Building context with events:', recentEvents.length);
    console.log('Recent events:', recentEvents.map(e => `${e.type}: ${e.description}`));

    // Only include the last 2 dice results instead of 5
    const recentDice = (story.diceResults || []).slice(-2);

    // Limit characters to only the most recent 3
    const recentCharacters = (story.characters || []).slice(-3);

    // Limit locations to only the most recent 2
    const recentLocations = (story.locations || []).slice(-2);

    const context = {
      story: {
        title: story.title || 'Untitled',
        genre: story.genre || 'Fantasy',
        setting: worldState.setting || 'To be determined',
        currentSituation: worldState.currentSituation || 'Story setup in progress',
        mood: worldState.mood || 'neutral',
        tone: worldState.tone || 'neutral'
      },
      recentEvents: recentEvents,
      recentDice: recentDice,
      recentCharacters: recentCharacters,
      recentLocations: recentLocations,
      userInput: userInput,
      diceResult: diceResult
    };

    return this.formatContext(context);
  }

  /**
   * Format context into a prompt
   */
  formatContext(context) {
    const { story, recentEvents, recentDice, recentCharacters, recentLocations, userInput, diceResult } = context;

    let prompt = `You are a Game Master (GM) for a collaborative storytelling game. Your role is to:

1. DESCRIBE SITUATIONS and environments vividly
2. PRESENT CHOICES to the player
3. RESPOND to player decisions and advance the story
4. INTEGRATE dice results when provided
5. ROLL DICE when appropriate situations arise

CRITICAL RULES:
- DO NOT make decisions for the player
- DO NOT write narrative on behalf of the player
- DO NOT answer your own questions
- DO NOT create numbered narrative sections
- DO NOT continue the story without player input
- DO NOT impose moral judgments on player choices
- RESPECT player agency in all situations, including morally complex ones
- When players make difficult choices, describe the consequences and continue the story
- If a player chooses violence, describe the action and its immediate consequences, then present new choices

DICE ROLLING:
- Roll a d20 when situations require skill checks, combat, or uncertain outcomes
- Be fair and balanced in your dice rolling
- Describe the dice result and its impact on the story
- Use dice to add tension and unpredictability to the narrative
- Examples: Stealth checks, combat attacks, persuasion attempts, perception checks

STORY CONTEXT:
Title: ${story.title}
Genre: ${story.genre}
Setting: ${story.setting}
Current Situation: ${story.currentSituation}
Mood: ${story.mood}
Tone: ${story.tone}

RECENT EVENTS:`;

    if (recentEvents.length > 0) {
      prompt += `\n${recentEvents.map(event => `- ${event.type}: ${event.description}`).join('\n')}`;
    } else {
      prompt += '\nNo recent events.';
    }

    if (recentCharacters.length > 0) {
      prompt += `\n\nCHARACTERS:\n${recentCharacters.map(char => `- ${char.name}: ${char.description}`).join('\n')}`;
    }

    if (recentLocations.length > 0) {
      prompt += `\n\nLOCATIONS:\n${recentLocations.map(loc => `- ${loc.name}: ${loc.description}`).join('\n')}`;
    }

    if (recentDice.length > 0) {
      prompt += `\n\nRECENT DICE ROLLS:\n${recentDice.map(roll => `- ${roll.description}: ${roll.result}`).join('\n')}`;
    }

    if (diceResult) {
      prompt += `\n\nCURRENT DICE RESULT:\n${diceResult.description}: ${diceResult.result}`;
    }

    prompt += `\n\nPLAYER INPUT: ${userInput}

Respond as the Game Master, advancing the story based on the player's input and the current situation.`;

    return prompt;
  }

  /**
   * Main method to generate story response
   */
    async generateStoryResponse(story, userInput, diceResult = null, userToken = null) {
    // Check if we're in setup phase
    const isSetupPhase = story.status === 'setup';

    // Build optimized context (this includes recent events, characters, locations, etc.)
    const optimizedContext = this.buildContext(story, userInput, diceResult);

    // For setup phase, modify the optimized context to be more setup-focused
    let prompt = optimizedContext;
    if (isSetupPhase) {
      // Replace the final instruction to ask questions instead of advancing the story
      prompt = optimizedContext.replace(
        'Respond as the Game Master, advancing the story based on the player\'s input and the current situation.',
        'Ask 2-3 specific questions to understand the player\'s vision for the story, then wait for their response. Focus on character details, setting specifics, tone, and initial conflict.'
      );
    }

    // Log prompt length and context info
    console.log(`Prompt length: ${prompt.length} characters`);
    console.log(`Estimated tokens: ~${Math.ceil(prompt.length / 4)}`);
    console.log(`Using optimized context with ${story.events?.length || 0} total events, showing last 3`);

    try {
      const response = await this.callBaseGeekAI(prompt, {
        maxTokens: 2000,
        temperature: 0.7
      }, userToken);

      console.log('StoryGeek AI response generated successfully');
      return { content: response };

    } catch (error) {
      console.error('StoryGeek AI generation failed:', error.message);
      throw new Error('Failed to generate story response');
    }
  }



  /**
   * Generate summary response
   */
  async generateSummaryResponse(prompt, userToken = null) {
    try {
      const response = await this.callBaseGeekAI(prompt, {
        maxTokens: 1000,
        temperature: 0.7
      }, userToken);

      console.log('Summary response generated successfully');
      return { content: response };

    } catch (error) {
      console.error('Summary generation failed:', error.message);
      throw new Error('Failed to generate summary');
    }
  }

  /**
   * Update session statistics
   */
  updateStats(provider) {
    this.sessionStats.totalCalls++;
    // Note: Detailed token/cost tracking is handled by baseGeek
  }

  /**
   * Get session statistics
   */
  getSessionStats() {
    return {
      ...this.sessionStats,
      note: 'Detailed statistics available in baseGeek AI management'
    };
  }

  /**
   * Reset session statistics
   */
  resetSessionStats() {
    this.sessionStats = {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0
    };
  }

  /**
   * Log API key status (delegated to baseGeek)
   */
  logApiKeyStatus() {
    console.log('StoryGeek AI service using centralized baseGeek AI APIs');
    console.log('API key status and configuration managed in baseGeek');
  }
}

module.exports = new AIService();