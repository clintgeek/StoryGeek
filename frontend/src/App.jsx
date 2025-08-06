import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { QueryClient, QueryClientProvider } from 'react-query';

// Components
import Layout from './components/Layout';
import StoryCreation from './pages/StoryCreation';
import StoryPlay from './pages/StoryPlay';
import StoryList from './pages/StoryList';
import CharacterSheet from './pages/CharacterSheet';
import Settings from './pages/Settings';

// Theme
import { lightTheme, darkTheme } from './theme/theme';

// Create React Query client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function App() {
  const [isDarkMode, setIsDarkMode] = useState(false);

  // Get theme from localStorage or default to light
  React.useEffect(() => {
    const savedTheme = localStorage.getItem('storyGeek-theme');
    if (savedTheme === 'dark') {
      setIsDarkMode(true);
    }
  }, []);

  const handleThemeToggle = () => {
    const newTheme = !isDarkMode;
    setIsDarkMode(newTheme);
    localStorage.setItem('storyGeek-theme', newTheme ? 'dark' : 'light');
  };

  const currentTheme = isDarkMode ? darkTheme : lightTheme;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider theme={currentTheme}>
        <CssBaseline />
        <Router>
          <Layout onThemeToggle={handleThemeToggle} isDarkMode={isDarkMode}>
            <Routes>
              <Route path="/" element={<StoryList />} />
              <Route path="/create" element={<StoryCreation />} />
              <Route path="/play/:storyId" element={<StoryPlay />} />
              <Route path="/characters/:storyId" element={<CharacterSheet />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </Layout>
        </Router>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;