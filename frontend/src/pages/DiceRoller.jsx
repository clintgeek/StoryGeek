import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Paper,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Alert,
} from '@mui/material';
import {
  Casino as DiceIcon,
  TrendingUp as AdvantageIcon,
  TrendingDown as DisadvantageIcon,
} from '@mui/icons-material';

function DiceRoller() {
  const [diceTypes, setDiceTypes] = useState([]);
  const [storyDiceTypes, setStoryDiceTypes] = useState([]);
  const [situations, setSituations] = useState([]);
  const [selectedDice, setSelectedDice] = useState('d20');
  const [selectedSituation, setSelectedSituation] = useState('');
  const [selectedStoryDice, setSelectedStoryDice] = useState('');
  const [rollCount, setRollCount] = useState(1);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDiceTypes();
  }, []);

  const loadDiceTypes = async () => {
    try {
      const response = await fetch('/api/dice/types');
      if (response.ok) {
        const data = await response.json();
        setDiceTypes(data.diceTypes);
        setStoryDiceTypes(data.storyDiceTypes);
        setSituations(data.situations);
      }
    } catch (error) {
      console.error('Error loading dice types:', error);
    }
  };

  const rollDice = async (type, situation = null) => {
    setLoading(true);
    try {
      const response = await fetch('/api/dice/roll', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diceType: type,
          situation: situation,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setResults(prev => [result, ...prev.slice(0, 9)]); // Keep last 10 results
      }
    } catch (error) {
      console.error('Error rolling dice:', error);
    } finally {
      setLoading(false);
    }
  };

  const rollWithAdvantage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dice/roll/advantage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diceType: selectedDice,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setResults(prev => [result, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      console.error('Error rolling with advantage:', error);
    } finally {
      setLoading(false);
    }
  };

  const rollWithDisadvantage = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dice/roll/disadvantage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diceType: selectedDice,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setResults(prev => [result, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      console.error('Error rolling with disadvantage:', error);
    } finally {
      setLoading(false);
    }
  };

  const rollMultiple = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dice/roll/multiple', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          diceType: selectedDice,
          count: rollCount,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setResults(prev => [result, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      console.error('Error rolling multiple dice:', error);
    } finally {
      setLoading(false);
    }
  };

  const rollStoryDice = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dice/roll/story', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedStoryDice,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setResults(prev => [result, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      console.error('Error rolling story dice:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Dice Roller
      </Typography>

      <Grid container spacing={3}>
        {/* Standard Dice */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Standard Dice
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Dice Type</InputLabel>
                <Select
                  value={selectedDice}
                  label="Dice Type"
                  onChange={(e) => setSelectedDice(e.target.value)}
                >
                  {diceTypes.map((dice) => (
                    <MenuItem key={dice} value={dice}>
                      {dice.toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Grid container spacing={1}>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="contained"
                    onClick={() => rollDice(selectedDice)}
                    disabled={loading}
                    startIcon={<DiceIcon />}
                  >
                    Roll
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={rollWithAdvantage}
                    disabled={loading}
                    startIcon={<AdvantageIcon />}
                  >
                    Advantage
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={rollWithDisadvantage}
                    disabled={loading}
                    startIcon={<DisadvantageIcon />}
                  >
                    Disadvantage
                  </Button>
                </Grid>
                <Grid item xs={6}>
                  <Button
                    fullWidth
                    variant="outlined"
                    onClick={rollMultiple}
                    disabled={loading}
                  >
                    Multiple
                  </Button>
                </Grid>
              </Grid>

              <TextField
                type="number"
                label="Roll Count"
                value={rollCount}
                onChange={(e) => setRollCount(parseInt(e.target.value) || 1)}
                sx={{ mt: 2 }}
                inputProps={{ min: 1, max: 10 }}
              />
            </CardContent>
          </Card>
        </Grid>

        {/* Situations */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Situations
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Situation</InputLabel>
                <Select
                  value={selectedSituation}
                  label="Situation"
                  onChange={(e) => setSelectedSituation(e.target.value)}
                >
                  <MenuItem value="">Select a situation</MenuItem>
                  {situations.map((situation) => (
                    <MenuItem key={situation} value={situation}>
                      {situation.charAt(0).toUpperCase() + situation.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                onClick={() => rollDice('d20', selectedSituation)}
                disabled={loading || !selectedSituation}
                startIcon={<DiceIcon />}
              >
                Roll for {selectedSituation || 'Situation'}
              </Button>
            </CardContent>
          </Card>
        </Grid>

        {/* Story Dice */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                Story Dice
              </Typography>

              <FormControl fullWidth sx={{ mb: 2 }}>
                <InputLabel>Story Element</InputLabel>
                <Select
                  value={selectedStoryDice}
                  label="Story Element"
                  onChange={(e) => setSelectedStoryDice(e.target.value)}
                >
                  <MenuItem value="">Select a story element</MenuItem>
                  {storyDiceTypes.map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                fullWidth
                variant="contained"
                onClick={rollStoryDice}
                disabled={loading || !selectedStoryDice}
                startIcon={<DiceIcon />}
              >
                Roll Story {selectedStoryDice || 'Element'}
              </Button>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Results */}
      {results.length > 0 && (
        <Card sx={{ mt: 3 }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Recent Rolls
            </Typography>

            {results.map((result, index) => (
              <Paper key={index} sx={{ p: 2, mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box>
                    <Typography variant="h6">
                      {result.diceType}: {result.result}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {result.interpretation}
                    </Typography>
                    {result.situation && (
                      <Chip
                        label={result.situation}
                        size="small"
                        sx={{ mt: 1 }}
                      />
                    )}
                    {result.advantage && (
                      <Chip
                        label="Advantage"
                        color="success"
                        size="small"
                        sx={{ mt: 1, ml: 1 }}
                      />
                    )}
                    {result.disadvantage && (
                      <Chip
                        label="Disadvantage"
                        color="error"
                        size="small"
                        sx={{ mt: 1, ml: 1 }}
                      />
                    )}
                  </Box>
                  <Typography variant="caption" color="text.secondary">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </Typography>
                </Box>

                {result.rolls && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="body2" color="text.secondary">
                      Rolls: {result.rolls.join(', ')} | Total: {result.total} | Average: {result.average.toFixed(1)}
                    </Typography>
                  </Box>
                )}
              </Paper>
            ))}
          </CardContent>
        </Card>
      )}
    </Box>
  );
}

export default DiceRoller;