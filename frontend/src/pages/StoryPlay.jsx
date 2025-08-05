import React, { useState, useEffect, useRef } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Paper,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import {
  Send as SendIcon,
  Casino as DiceIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  AttachMoney as CostIcon,
  Pause as PauseIcon,
  PlayArrow as PlayIcon,
} from '@mui/icons-material';
import { useParams, useNavigate } from 'react-router-dom';

function StoryPlay() {
  const { storyId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const [messages, setMessages] = useState([]);
  const [userInput, setUserInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [story, setStory] = useState(null);
  const [error, setError] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [costInfo, setCostInfo] = useState(null);

  // Scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load story on component mount
  useEffect(() => {
    loadStory();
  }, [storyId]);

  const loadStory = async () => {
    try {
      const response = await fetch(`/api/stories/${storyId}`);
      if (!response.ok) {
        throw new Error('Failed to load story');
      }

      const storyData = await response.json();
      setStory(storyData);

      // Convert story events to messages
      const storyMessages = storyData.events.map(event => ({
        type: 'ai',
        content: event.description,
        timestamp: new Date(event.timestamp),
        diceResults: event.diceResults || []
      }));

      setMessages(storyMessages);

    } catch (error) {
      setError('Failed to load story');
      console.error('Error loading story:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!userInput.trim() || loading) return;

    const input = userInput.trim();
    setUserInput('');

    // Add user message
    const userMessage = {
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setLoading(true);
    setError('');

    try {
      const response = await fetch(`/api/stories/${storyId}/continue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userInput: input
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to continue story');
      }

      const data = await response.json();

      // Handle special command responses
      if (data.type) {
        handleSpecialResponse(data);
        return;
      }

      // Add AI response
      const aiMessage = {
        type: 'ai',
        content: data.aiResponse,
        timestamp: new Date(),
        diceResults: data.diceResult ? [data.diceResult] : [],
        cost: data.cost,
        totalCost: data.totalCost
      };

      setMessages(prev => [...prev, aiMessage]);

      // Update story data
      if (story) {
        setStory(prev => ({
          ...prev,
          stats: {
            ...prev.stats,
            totalInteractions: data.currentChapter,
            totalCost: data.totalCost
          },
          worldState: {
            ...prev.worldState,
            currentChapter: data.currentChapter
          }
        }));
      }

      // Show cost reminder every $0.50
      if (data.totalCost && Math.floor(data.totalCost * 2) > Math.floor((data.totalCost - data.cost) * 2)) {
        setCostInfo({
          currentCost: data.cost,
          totalCost: data.totalCost
        });
        setShowCostDialog(true);
      }

    } catch (error) {
      setError('Failed to continue story');
      console.error('Error continuing story:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSpecialResponse = (data) => {
    switch (data.type) {
      case 'character_list':
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Available characters:\n${data.characters.map(char =>
            `- ${char.name}: ${char.description}${char.isActive ? ' (Active)' : ' (Inactive)'}`
          ).join('\n')}`,
          timestamp: new Date()
        }]);
        break;

      case 'character_info':
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Character: ${data.character.name}\nDescription: ${data.character.description}\nPersonality: ${data.character.personality || 'Not specified'}\nBackground: ${data.character.background || 'Not specified'}\nCurrent State: ${data.character.currentState || 'Not specified'}`,
          timestamp: new Date()
        }]);
        break;

      case 'info':
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Information about "${data.query}":\n${JSON.stringify(data.details, null, 2)}`,
          timestamp: new Date()
        }]);
        break;

      case 'timeout':
        setMessages(prev => [...prev, {
          type: 'ai',
          content: data.aiResponse,
          timestamp: new Date(),
          cost: data.cost,
          isTimeout: true
        }]);
        break;

      case 'cost_info':
        setCostInfo(data);
        setShowCostDialog(true);
        break;

      case 'story_ended':
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Story ended. Final stats: ${data.finalStats.totalInteractions} interactions, $${data.finalStats.totalCost.toFixed(4)} total cost.`,
          timestamp: new Date()
        }]);
        break;

      case 'error':
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Error: ${data.message}`,
          timestamp: new Date()
        }]);
        break;

      default:
        setMessages(prev => [...prev, {
          type: 'system',
          content: `Unknown response type: ${data.type}`,
          timestamp: new Date()
        }]);
    }
  };

  const handleCommand = (command) => {
    setUserInput(command);
    inputRef.current?.focus();
  };

  const formatMessage = (message) => {
    const isUser = message.type === 'user';
    const isSystem = message.type === 'system';
    const isTimeout = message.isTimeout;

    return (
      <Box
        key={message.timestamp.getTime()}
        sx={{
          display: 'flex',
          justifyContent: isUser ? 'flex-end' : 'flex-start',
          mb: 2,
        }}
      >
        <Paper
          sx={{
            p: 2,
            maxWidth: '70%',
            backgroundColor: isUser ? 'primary.main' : 'background.paper',
            color: isUser ? 'white' : 'text.primary',
            border: isTimeout ? 2 : 1,
            borderColor: isTimeout ? 'warning.main' : 'divider',
          }}
        >
          <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Typography>

          {message.diceResults && message.diceResults.length > 0 && (
            <Box sx={{ mt: 1 }}>
              {message.diceResults.map((dice, index) => (
                <Chip
                  key={index}
                  icon={<DiceIcon />}
                  label={`${dice.diceType}: ${dice.result} - ${dice.interpretation}`}
                  size="small"
                  sx={{ mr: 1, mb: 1 }}
                />
              ))}
            </Box>
          )}

          {message.cost && (
            <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.7 }}>
              Cost: ${message.cost.toFixed(4)}
            </Typography>
          )}

          <Typography variant="caption" sx={{ display: 'block', mt: 1, opacity: 0.5 }}>
            {message.timestamp.toLocaleTimeString()}
          </Typography>
        </Paper>
      </Box>
    );
  };

  if (!story) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '50vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {/* Story Header */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Grid container alignItems="center" spacing={2}>
            <Grid item xs>
              <Typography variant="h5">{story.title}</Typography>
              <Typography variant="body2" color="text.secondary">
                {story.genre} • Chapter {story.worldState.currentChapter} • {story.status}
              </Typography>
            </Grid>
            <Grid item>
              <IconButton onClick={() => setShowCostDialog(true)}>
                <CostIcon />
              </IconButton>
              <IconButton onClick={() => setShowCommands(!showCommands)}>
                <InfoIcon />
              </IconButton>
            </Grid>
          </Grid>
        </CardContent>
      </Card>

      {/* Commands Panel */}
      {showCommands && (
        <Paper sx={{ p: 2, mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            Available Commands
          </Typography>
          <Grid container spacing={1}>
            <Grid item>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleCommand('/char')}
                startIcon={<PersonIcon />}
              >
                List Characters
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleCommand('/info')}
                startIcon={<InfoIcon />}
              >
                Get Info
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleCommand('/timeout')}
                startIcon={<PauseIcon />}
              >
                Timeout
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleCommand('/cost')}
                startIcon={<CostIcon />}
              >
                Cost Info
              </Button>
            </Grid>
            <Grid item>
              <Button
                variant="outlined"
                size="small"
                onClick={() => handleCommand('/end')}
                color="error"
              >
                End Story
              </Button>
            </Grid>
          </Grid>
        </Paper>
      )}

      {/* Messages */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {messages.map(formatMessage)}
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-start', mb: 2 }}>
            <Paper sx={{ p: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center' }}>
                <CircularProgress size={20} sx={{ mr: 1 }} />
                <Typography>AI is thinking...</Typography>
              </Box>
            </Paper>
          </Box>
        )}
        <div ref={messagesEndRef} />
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Input Form */}
      <Paper sx={{ p: 2 }}>
        <Box component="form" onSubmit={handleSubmit} sx={{ display: 'flex', gap: 1 }}>
          <TextField
            fullWidth
            value={userInput}
            onChange={(e) => setUserInput(e.target.value)}
            placeholder="Type your action, choice, or command..."
            disabled={loading}
            inputRef={inputRef}
            multiline
            maxRows={3}
          />
          <Button
            type="submit"
            variant="contained"
            disabled={loading || !userInput.trim()}
            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
          >
            Send
          </Button>
        </Box>
      </Paper>

      {/* Cost Dialog */}
      <Dialog open={showCostDialog} onClose={() => setShowCostDialog(false)}>
        <DialogTitle>Cost Information</DialogTitle>
        <DialogContent>
          {costInfo && (
            <Box>
              <Typography variant="body1" gutterBottom>
                Total Cost: ${costInfo.totalCost?.toFixed(4) || '0.0000'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Total Interactions: {costInfo.totalInteractions || 0}
              </Typography>
              {costInfo.averageCostPerInteraction && (
                <Typography variant="body2" color="text.secondary">
                  Average Cost per Interaction: ${costInfo.averageCostPerInteraction.toFixed(4)}
                </Typography>
              )}
              {costInfo.estimatedRemainingCalls && (
                <Typography variant="body2" color="text.secondary">
                  Estimated Remaining Calls: {costInfo.estimatedRemainingCalls}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowCostDialog(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default StoryPlay;