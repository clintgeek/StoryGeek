const express = require('express');
const router = express.Router();
const diceService = require('../services/diceService');

// Get available dice types
router.get('/types', (req, res) => {
  try {
    const diceTypes = diceService.getAvailableDiceTypes();
    const storyDiceTypes = diceService.getAvailableStoryDiceTypes();
    const situations = diceService.getAvailableSituations();

    res.json({
      diceTypes,
      storyDiceTypes,
      situations
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get dice types' });
  }
});

// Roll a specific dice
router.post('/roll', (req, res) => {
  try {
    const { diceType, situation } = req.body;

    let result;
    if (situation) {
      result = diceService.rollForSituation(situation);
    } else if (diceType) {
      result = diceService.roll(diceType);
    } else {
      return res.status(400).json({ error: 'Dice type or situation required' });
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to roll dice' });
  }
});

// Roll with advantage
router.post('/roll/advantage', (req, res) => {
  try {
    const { diceType = 'd20' } = req.body;
    const result = diceService.rollWithAdvantage(diceType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to roll with advantage' });
  }
});

// Roll with disadvantage
router.post('/roll/disadvantage', (req, res) => {
  try {
    const { diceType = 'd20' } = req.body;
    const result = diceService.rollWithDisadvantage(diceType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to roll with disadvantage' });
  }
});

// Roll multiple dice
router.post('/roll/multiple', (req, res) => {
  try {
    const { diceType, count } = req.body;

    if (!diceType || !count) {
      return res.status(400).json({ error: 'Dice type and count required' });
    }

    const result = diceService.rollMultiple(diceType, count);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to roll multiple dice' });
  }
});

// Roll story dice
router.post('/roll/story', (req, res) => {
  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Story dice type required' });
    }

    const result = diceService.rollStoryDice(type);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to roll story dice' });
  }
});

// Generate random story element
router.post('/generate', (req, res) => {
  try {
    const { type } = req.body;

    if (!type) {
      return res.status(400).json({ error: 'Element type required' });
    }

    const element = diceService.generateStoryElement(type);
    res.json(element);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate story element' });
  }
});

module.exports = router;