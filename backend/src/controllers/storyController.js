const Story = require('../models/Story');
const aiService = require('../services/aiService');
const contextService = require('../services/contextService');
const diceService = require('../services/diceService');

class StoryController {
  // Start a new story with /start command
  async startStory(req, res) {
    try {
      const { userId, prompt, title, genre, description } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Story prompt is required' });
      }

      // Generate initial story setup with AI
      const setupPrompt = `
        A player wants to start a new story with the following prompt:
        "${prompt}"

        Genre: ${genre || 'Fantasy'}
        Title: ${title || 'Untitled Story'}

        Please help set up this story by asking clarifying questions about:
        1. Tone and atmosphere
        2. Level of violence/gore
        3. Magic system (if fantasy)
        4. Technology level
        5. Main character details
        6. Starting location
        7. Any specific story elements they want to include

        Ask 3-5 specific questions to help establish the world and story direction.
        Be conversational and helpful.
      `;

      const aiResponse = await aiService.generateStoryResponse(
        { title: title || 'Untitled', genre: genre || 'Fantasy' },
        setupPrompt
      );

      // Create initial story structure
      const story = new Story({
        userId,
        title: title || 'Untitled Story',
        genre: genre || 'Fantasy',
        description: description || '',
        worldState: {
          setting: 'To be determined',
          currentSituation: 'Story setup in progress',
          currentChapter: 1,
          mood: 'neutral',
          weather: 'clear',
          timeOfDay: 'morning'
        },
        aiContext: {
          lastPrompt: setupPrompt,
          worldRules: '',
          storyTone: 'adventure',
          magicSystem: '',
          technologyLevel: 'medieval'
        },
        status: 'setup',
        stats: {
          totalInteractions: 0,
          totalDiceRolls: 0,
          totalCost: aiResponse.cost,
          lastActive: new Date()
        }
      });

      await story.save();

      res.json({
        storyId: story._id,
        aiResponse: aiResponse.content,
        setupQuestions: aiResponse.content,
        cost: aiResponse.cost
      });

    } catch (error) {
      console.error('Error starting story:', error);
      res.status(500).json({ error: 'Failed to start story' });
    }
  }

  // Continue story with user input
  async continueStory(req, res) {
    try {
      const { storyId } = req.params;
      const { userInput, diceRoll } = req.body;

      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      // Handle special commands
      if (userInput.startsWith('/')) {
        return await this.handleSpecialCommand(req, res, story, userInput);
      }

      // Determine if dice roll is needed
      let diceResult = null;
      if (diceRoll) {
        diceResult = diceService.roll(diceRoll.diceType);
        if (diceRoll.situation) {
          diceResult = diceService.rollForSituation(diceRoll.situation);
        }
      } else if (this.needsDiceRoll(userInput)) {
        // Auto-roll for variable outcomes
        diceResult = diceService.rollForSituation(this.determineSituation(userInput));
      }

      // Build context and generate AI response
      const context = await contextService.buildContext(story, userInput);
      const aiResponse = await aiService.generateStoryResponse(story, userInput, diceResult);

      // Update story with new event
      const newEvent = {
        type: 'narrative',
        description: aiResponse.content,
        timestamp: new Date(),
        diceResults: diceResult ? [diceResult] : []
      };

      story.events.push(newEvent);
      story.stats.totalInteractions++;
      story.stats.totalCost += aiResponse.cost;
      story.stats.lastActive = new Date();

      // Update current situation from AI response
      story.worldState.currentSituation = this.extractCurrentSituation(aiResponse.content);

      // Check if we need to generate a chapter summary
      if (contextService.shouldGenerateSummary(story)) {
        const summary = await contextService.generateChapterSummary(story, story.worldState.currentChapter);
        if (summary) {
          if (!story.chapterSummaries) {
            story.chapterSummaries = [];
          }
          story.chapterSummaries.push(summary);
          story.worldState.currentChapter++;
        }
      }

      // Add dice result to history if present
      if (diceResult) {
        story.diceResults.push(diceResult);
        story.stats.totalDiceRolls++;
      }

      await story.save();

      res.json({
        aiResponse: aiResponse.content,
        diceResult,
        cost: aiResponse.cost,
        totalCost: story.stats.totalCost,
        currentChapter: story.worldState.currentChapter
      });

    } catch (error) {
      console.error('Error continuing story:', error);
      res.status(500).json({ error: 'Failed to continue story' });
    }
  }

  // Handle special commands like /char, /info, /timeout
  async handleSpecialCommand(req, res, story, userInput) {
    const command = userInput.toLowerCase().trim();

    if (command.startsWith('/char')) {
      // Get character info
      const characterName = command.replace('/char', '').trim();
      if (!characterName) {
        return res.json({
          type: 'character_list',
          characters: story.characters.map(char => ({
            name: char.name,
            description: char.description,
            isActive: char.isActive
          }))
        });
      }

      const characterInfo = await contextService.getCharacterInfo(story._id, characterName);
      if (!characterInfo) {
        return res.json({
          type: 'error',
          message: `Character "${characterName}" not found.`
        });
      }

      return res.json({
        type: 'character_info',
        character: characterInfo
      });
    }

    if (command.startsWith('/info')) {
      // Get info about anything mentioned
      const query = command.replace('/info', '').trim();
      if (!query) {
        return res.json({
          type: 'error',
          message: 'Please specify what you want information about. Use /info [name]'
        });
      }

      const details = await contextService.queryStoryDetails(story._id, query);
      return res.json({
        type: 'info',
        query,
        details
      });
    }

    if (command.startsWith('/timeout')) {
      // Handle timeout for meta-discussion
      const metaTopic = command.replace('/timeout', '').trim();
      const timeoutPrompt = `
        The player has called a timeout for meta-discussion.
        ${metaTopic ? `Topic: ${metaTopic}` : 'General discussion'}

        This is a break from the story. Please help the player with:
        1. Clarifying story elements
        2. Discussing game mechanics
        3. Addressing any concerns
        4. Planning next steps

        Be helpful and conversational, but remember this is outside the story.
      `;

      const aiResponse = await aiService.generateStoryResponse(story, timeoutPrompt);

      return res.json({
        type: 'timeout',
        aiResponse: aiResponse.content,
        cost: aiResponse.cost
      });
    }

    if (command.startsWith('/cost')) {
      // Get cost information
      return res.json({
        type: 'cost_info',
        totalCost: story.stats.totalCost,
        totalInteractions: story.stats.totalInteractions,
        averageCostPerInteraction: story.stats.totalCost / story.stats.totalInteractions,
        estimatedRemainingCalls: aiService.estimateRemainingCalls(1.00) // $1 budget
      });
    }

    if (command.startsWith('/end')) {
      // End the story
      story.status = 'completed';
      await story.save();

      return res.json({
        type: 'story_ended',
        message: 'Story has been marked as completed.',
        finalStats: {
          totalCost: story.stats.totalCost,
          totalInteractions: story.stats.totalInteractions,
          totalDiceRolls: story.stats.totalDiceRolls
        }
      });
    }

    return res.json({
      type: 'error',
      message: 'Unknown command. Available commands: /char, /info, /timeout, /cost, /end'
    });
  }

  // Determine if user input needs a dice roll
  needsDiceRoll(userInput) {
    const diceKeywords = [
      'attack', 'fight', 'combat', 'battle', 'hit', 'strike',
      'persuade', 'convince', 'negotiate', 'bargain', 'bribe',
      'stealth', 'sneak', 'hide', 'conceal',
      'investigate', 'search', 'examine', 'inspect',
      'survive', 'navigate', 'find', 'locate',
      'repair', 'fix', 'craft', 'build',
      'cast', 'spell', 'magic', 'ritual'
    ];

    const input = userInput.toLowerCase();
    return diceKeywords.some(keyword => input.includes(keyword));
  }

  // Determine situation type for dice roll
  determineSituation(userInput) {
    const input = userInput.toLowerCase();

    if (input.includes('attack') || input.includes('fight') || input.includes('combat')) {
      return 'combat';
    }
    if (input.includes('persuade') || input.includes('convince') || input.includes('bribe')) {
      return 'persuasion';
    }
    if (input.includes('stealth') || input.includes('sneak') || input.includes('hide')) {
      return 'stealth';
    }
    if (input.includes('investigate') || input.includes('search') || input.includes('examine')) {
      return 'investigation';
    }
    if (input.includes('survive') || input.includes('navigate') || input.includes('find')) {
      return 'survival';
    }

    return 'general'; // Default to general d20 roll
  }

  // Extract current situation from AI response
  extractCurrentSituation(aiResponse) {
    // Simple extraction - in practice, you might want more sophisticated parsing
    const sentences = aiResponse.split('.');
    if (sentences.length > 0) {
      return sentences[0].trim();
    }
    return 'Story continues...';
  }

  // Get all stories for a user
  async getUserStories(req, res) {
    try {
      const { userId } = req.params;

      const stories = await Story.find({ userId })
        .select('title genre status stats worldState createdAt updatedAt')
        .sort({ updatedAt: -1 });

      res.json(stories);
    } catch (error) {
      console.error('Error getting user stories:', error);
      res.status(500).json({ error: 'Failed to get stories' });
    }
  }

  // Get specific story details
  async getStory(req, res) {
    try {
      const { storyId } = req.params;

      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      res.json(story);
    } catch (error) {
      console.error('Error getting story:', error);
      res.status(500).json({ error: 'Failed to get story' });
    }
  }

  // Update story status
  async updateStoryStatus(req, res) {
    try {
      const { storyId } = req.params;
      const { status } = req.body;

      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      story.status = status;
      await story.save();

      res.json({ message: 'Story status updated', status });
    } catch (error) {
      console.error('Error updating story status:', error);
      res.status(500).json({ error: 'Failed to update story status' });
    }
  }
}

module.exports = new StoryController();