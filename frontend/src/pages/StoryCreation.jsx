import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Paper,
  Divider,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
} from '@mui/material';
import {
  AutoAwesome as MagicIcon,

  Book as BookIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';

const genres = [
  'Fantasy',
  'Sci-Fi',
  'Horror',
  'Romance',
  'Mystery',
  'Adventure',
  'Historical',
  'Contemporary',
  'Post-Apocalyptic',
  'Steampunk',
  'Cyberpunk',
  'Western',
];

const storyTemplates = [
  {
    name: 'Hero\'s Journey',
    description: 'A classic adventure where a hero embarks on a quest',
    genre: 'Fantasy',
    prompt: 'A young hero discovers they have a special destiny and must embark on a dangerous quest.',
  },
  {
    name: 'Mystery Manor',
    description: 'A mysterious mansion holds dark secrets',
    genre: 'Horror',
    prompt: 'A detective arrives at an old mansion to investigate strange occurrences.',
  },
  {
    name: 'Space Explorer',
    description: 'Exploring the vast reaches of space',
    genre: 'Sci-Fi',
    prompt: 'A space explorer discovers an ancient alien civilization.',
  },
  {
    name: 'Medieval Quest',
    description: 'A knight\'s journey through a magical realm',
    genre: 'Fantasy',
    prompt: 'A knight is tasked with retrieving a powerful artifact from a dangerous realm.',
  },
];

function StoryCreation() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    title: '',
    genre: '',
    description: '',
    prompt: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleInputChange = (field) => (event) => {
    console.log(`Setting ${field} to:`, event.target.value);
    setFormData(prev => ({
      ...prev,
      [field]: event.target.value
    }));
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      title: template.name,
      genre: template.genre,
      prompt: template.prompt,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!formData.title || !formData.genre || !formData.prompt) {
      setError('Please fill in all required fields');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // TODO: Call API to create story
      const response = await fetch('/api/stories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to create story');
      }

      const story = await response.json();
      navigate(`/play/${story._id}`);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateRandomPrompt = () => {
    const prompts = [
      'A mysterious artifact is discovered in an ancient temple.',
      'A young wizard learns they have a special destiny.',
      'A group of adventurers find a map to hidden treasure.',
      'A detective investigates a series of supernatural crimes.',
      'A space explorer discovers an abandoned alien ship.',
      'A knight must protect a village from dark forces.',
      'A scientist creates a device that opens portals to other worlds.',
      'A thief steals a powerful magical item.',
    ];

    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    setFormData(prev => ({
      ...prev,
      prompt: randomPrompt
    }));
  };

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ mb: 4 }}>
        Create New Story
      </Typography>

      <Grid container spacing={4}>
        {/* Story Templates */}
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <BookIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Story Templates
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Choose a template to get started quickly, or create your own story from scratch.
              </Typography>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {storyTemplates.map((template) => (
                  <Paper
                    key={template.name}
                    sx={{
                      p: 2,
                      cursor: 'pointer',
                      border: selectedTemplate?.name === template.name ? 2 : 1,
                      borderColor: selectedTemplate?.name === template.name ? 'primary.main' : 'divider',
                      backgroundColor: selectedTemplate?.name === template.name ? 'primary.main' : 'background.paper',
                      color: selectedTemplate?.name === template.name ? 'white' : 'text.primary',
                      '&:hover': {
                        borderColor: 'primary.main',
                        backgroundColor: selectedTemplate?.name === template.name ? 'primary.dark' : 'action.hover',
                      },
                    }}
                    onClick={() => handleTemplateSelect(template)}
                  >
                    <Typography variant="subtitle1" fontWeight="bold">
                      {template.name}
                    </Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                      {template.description}
                    </Typography>
                    <Chip
                      label={template.genre}
                      size="small"
                      sx={{
                        backgroundColor: selectedTemplate?.name === template.name ? 'white' : 'primary.main',
                        color: selectedTemplate?.name === template.name ? 'primary.main' : 'white',
                      }}
                    />
                  </Paper>
                ))}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Story Creation Form */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" gutterBottom>
                <AddIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                Story Details
              </Typography>

              {error && (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {error}
                </Alert>
              )}

              <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Story Title"
                      value={formData.title}
                      onChange={handleInputChange('title')}
                      required
                      placeholder="Enter your story title..."
                    />
                  </Grid>

                  <Grid item xs={12} md={6}>
                    <TextField
                      fullWidth
                      select
                      label="Genre"
                      value={formData.genre}
                      onChange={handleInputChange('genre')}
                      required
                      helperText="Select a genre for your story"
                    >
                      {genres.map((genre) => (
                        <MenuItem key={genre} value={genre}>
                          {genre}
                        </MenuItem>
                      ))}
                    </TextField>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Story Prompt"
                      value={formData.prompt}
                      onChange={handleInputChange('prompt')}
                      required
                      multiline
                      rows={4}
                      placeholder="Describe your story idea, characters, or world..."
                      helperText="Be as detailed or brief as you like. The AI will build the world around your prompt."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Button
                      variant="outlined"
                      onClick={generateRandomPrompt}
                      startIcon={<MagicIcon />}
                      sx={{ mr: 2 }}
                    >
                      Generate Random Prompt
                    </Button>
                    <Button
                      variant="outlined"
                      startIcon={<DiceIcon />}
                    >
                      Roll for Inspiration
                    </Button>
                  </Grid>

                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="Additional Details (Optional)"
                      value={formData.description}
                      onChange={handleInputChange('description')}
                      multiline
                      rows={3}
                      placeholder="Any additional details about your story..."
                    />
                  </Grid>

                  <Grid item xs={12}>
                    <Divider sx={{ my: 2 }} />
                    <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-end' }}>
                      <Button
                        variant="outlined"
                        onClick={() => navigate('/')}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        variant="contained"
                        disabled={loading}
                        startIcon={loading ? <CircularProgress size={20} /> : <AddIcon />}
                      >
                        {loading ? 'Creating Story...' : 'Create Story'}
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default StoryCreation;