const axios = require('axios');

class AIService {
  constructor() {
    this.providers = {
      claude: {
        name: 'Claude 3 Haiku',
        apiKey: process.env.CLAUDE_API_KEY,
        baseURL: 'https://api.anthropic.com/v1',
        model: 'claude-3-haiku-20240307',
        costPer1kTokens: 0.00025,
        maxTokens: 4000,
        temperature: 0.8
      },
      groq: {
        name: 'Groq Mixtral',
        apiKey: process.env.GROQ_API_KEY,
        baseURL: 'https://api.groq.com/openai/v1',
        model: 'mixtral-8x7b-32768',
        costPer1kTokens: 0.00027,
        maxTokens: 4000,
        temperature: 0.8
      },
      gemini: {
        name: 'Gemini 1.5 Flash',
        apiKey: process.env.GEMINI_API_KEY,
        baseURL: 'https://generativelanguage.googleapis.com/v1beta',
        model: 'gemini-1.5-flash',
        costPer1kTokens: 0.00035,
        maxTokens: 4000,
        temperature: 0.8
      }
    };

    this.currentProvider = 'claude';
    this.fallbackOrder = ['claude', 'groq', 'gemini'];
    this.sessionStats = {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0,
      providerUsage: {}
    };
  }

  // Build context for AI prompt
  buildContext(story, userInput, diceResult = null) {
    const context = {
      story: {
        title: story.title,
        genre: story.genre,
        currentChapter: story.worldState.currentChapter,
        setting: story.worldState.setting,
        currentSituation: story.worldState.currentSituation,
        mood: story.worldState.mood,
        weather: story.worldState.weather,
        timeOfDay: story.worldState.timeOfDay
      },

      characters: story.characters.slice(0, 8), // Limit to 8 most relevant
      locations: story.locations.slice(0, 5), // Limit to 5 most relevant

      recentEvents: story.events.slice(-10), // Last 10 events
      diceHistory: story.diceResults.slice(-5), // Last 5 dice rolls

      aiContext: story.aiContext,
      userInput: userInput,
      diceResult: diceResult
    };

    return this.formatContext(context);
  }

  // Format context for AI consumption
  formatContext(context) {
    let formatted = `STORY CONTEXT:
Title: ${context.story.title}
Genre: ${context.story.genre}
Chapter: ${context.story.currentChapter}
Setting: ${context.story.setting}
Current Situation: ${context.story.currentSituation}
Mood: ${context.story.mood}
Weather: ${context.story.weather}
Time: ${context.story.timeOfDay}

ACTIVE CHARACTERS:
${context.characters.map(char =>
  `- ${char.name}: ${char.description}${char.personality ? ` (${char.personality})` : ''}`
).join('\n')}

KNOWN LOCATIONS:
${context.locations.map(loc =>
  `- ${loc.name}: ${loc.description}`
).join('\n')}

RECENT EVENTS:
${context.recentEvents.map(event =>
  `- ${event.type}: ${event.description}`
).join('\n')}

DICE HISTORY:
${context.diceHistory.map(dice =>
  `- ${dice.diceType}: ${dice.result} (${dice.interpretation})`
).join('\n')}

AI CONTEXT:
World Rules: ${context.aiContext.worldRules}
Story Tone: ${context.aiContext.storyTone}
Magic System: ${context.aiContext.magicSystem}

USER INPUT: ${context.userInput}
${context.diceResult ? `DICE RESULT: ${context.diceResult.diceType} = ${context.diceResult.result} (${context.diceResult.interpretation})` : ''}

RESPONSE FORMAT:
1. Brief narrative continuation (2-3 sentences)
2. Present 2-3 choices to the player
3. Ask for any additional details they want to add

Keep responses under 200 words. Focus on advancing the story naturally.`;

    return formatted;
  }

  // Call Claude API
  async callClaude(prompt) {
    try {
      const response = await axios.post(
        `${this.providers.claude.baseURL}/messages`,
        {
          model: this.providers.claude.model,
          max_tokens: this.providers.claude.maxTokens,
          temperature: this.providers.claude.temperature,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers.claude.apiKey}`,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          }
        }
      );

      const tokens = response.data.usage?.total_tokens || 0;
      const cost = (tokens / 1000) * this.providers.claude.costPer1kTokens;

      this.updateStats('claude', tokens, cost);

      return {
        content: response.data.content[0].text,
        tokens: tokens,
        cost: cost,
        provider: 'claude'
      };
    } catch (error) {
      console.error('Claude API error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Call Groq API
  async callGroq(prompt) {
    try {
      const response = await axios.post(
        `${this.providers.groq.baseURL}/chat/completions`,
        {
          model: this.providers.groq.model,
          max_tokens: this.providers.groq.maxTokens,
          temperature: this.providers.groq.temperature,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers.groq.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const tokens = response.data.usage?.total_tokens || 0;
      const cost = (tokens / 1000) * this.providers.groq.costPer1kTokens;

      this.updateStats('groq', tokens, cost);

      return {
        content: response.data.choices[0].message.content,
        tokens: tokens,
        cost: cost,
        provider: 'groq'
      };
    } catch (error) {
      console.error('Groq API error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Call Gemini API
  async callGemini(prompt) {
    try {
      const response = await axios.post(
        `${this.providers.gemini.baseURL}/models/${this.providers.gemini.model}:generateContent`,
        {
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            maxOutputTokens: this.providers.gemini.maxTokens,
            temperature: this.providers.gemini.temperature
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${this.providers.gemini.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      // Gemini doesn't provide token usage in response, estimate
      const estimatedTokens = Math.ceil(prompt.length / 4) + Math.ceil(response.data.candidates[0].content.parts[0].text.length / 4);
      const cost = (estimatedTokens / 1000) * this.providers.gemini.costPer1kTokens;

      this.updateStats('gemini', estimatedTokens, cost);

      return {
        content: response.data.candidates[0].content.parts[0].text,
        tokens: estimatedTokens,
        cost: cost,
        provider: 'gemini'
      };
    } catch (error) {
      console.error('Gemini API error:', error.response?.data || error.message);
      throw error;
    }
  }

  // Main method to generate story response
  async generateStoryResponse(story, userInput, diceResult = null) {
    const context = this.buildContext(story, userInput, diceResult);

    // Try providers in order
    for (const provider of this.fallbackOrder) {
      try {
        console.log(`Trying ${this.providers[provider].name}...`);

        let response;
        switch (provider) {
          case 'claude':
            response = await this.callClaude(context);
            break;
          case 'groq':
            response = await this.callGroq(context);
            break;
          case 'gemini':
            response = await this.callGemini(context);
            break;
          default:
            throw new Error(`Unknown provider: ${provider}`);
        }

        console.log(`Success with ${this.providers[provider].name}`);
        return response;

      } catch (error) {
        console.log(`${this.providers[provider].name} failed, trying next...`);
        continue;
      }
    }

    throw new Error('All AI providers failed');
  }

  // Update session statistics
  updateStats(provider, tokens, cost) {
    this.sessionStats.totalCalls++;
    this.sessionStats.totalTokens += tokens;
    this.sessionStats.totalCost += cost;

    if (!this.sessionStats.providerUsage[provider]) {
      this.sessionStats.providerUsage[provider] = { calls: 0, tokens: 0, cost: 0 };
    }

    this.sessionStats.providerUsage[provider].calls++;
    this.sessionStats.providerUsage[provider].tokens += tokens;
    this.sessionStats.providerUsage[provider].cost += cost;

    console.log(`AI Call: ${provider}, Tokens: ${tokens}, Cost: $${cost.toFixed(4)}, Total: $${this.sessionStats.totalCost.toFixed(4)}`);
  }

  // Get session statistics
  getSessionStats() {
    return {
      ...this.sessionStats,
      averageTokensPerCall: this.sessionStats.totalCalls > 0 ?
        Math.round(this.sessionStats.totalTokens / this.sessionStats.totalCalls) : 0,
      averageCostPerCall: this.sessionStats.totalCalls > 0 ?
        this.sessionStats.totalCost / this.sessionStats.totalCalls : 0
    };
  }

  // Reset session statistics
  resetSessionStats() {
    this.sessionStats = {
      totalCalls: 0,
      totalTokens: 0,
      totalCost: 0,
      providerUsage: {}
    };
  }

  // Estimate remaining calls based on budget
  estimateRemainingCalls(budget = 0.10) {
    const avgCostPerCall = this.sessionStats.totalCalls > 0 ?
      this.sessionStats.totalCost / this.sessionStats.totalCalls : 0.002;

    return Math.floor((budget - this.sessionStats.totalCost) / avgCostPerCall);
  }
}

module.exports = new AIService();