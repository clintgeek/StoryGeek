import React, { useState } from 'react';
import {
  AppBar,
  Box,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
  useTheme,
  useMediaQuery,
  Container,
  Divider,
} from '@mui/material';
import {
  Menu as MenuIcon,
  Book as BookIcon,
  Add as AddIcon,
  People as PeopleIcon,
  Settings as SettingsIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  AutoStories as AutoStoriesIcon,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';

const drawerWidth = 220;

const baseMenuItems = [
  { text: 'My Stories', icon: <BookIcon />, path: '/' },
  { text: 'Create Story', icon: <AddIcon />, path: '/create' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const storyMenuItems = [
  { text: 'Characters', icon: <PeopleIcon />, path: '/characters' },
];

function Layout({ children, onThemeToggle, isDarkMode }) {
  const theme = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [drawerOpen, setDrawerOpen] = useState(false);

  // Check if we're in a story context (play or characters route)
  const isInStoryContext = location.pathname.startsWith('/play/') || location.pathname.startsWith('/characters/');

  // Combine menu items based on context
  const menuItems = isInStoryContext ? [...baseMenuItems, ...storyMenuItems] : baseMenuItems;

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  const handleNavigation = (path) => {
    // If navigating to characters from a story context, include the storyId
    if (path === '/characters' && isInStoryContext) {
      const storyId = location.pathname.match(/\/(play|characters)\/([^\/]+)/)?.[2];
      if (storyId) {
        navigate(`/characters/${storyId}`);
      } else {
        navigate(path);
      }
    } else {
      navigate(path);
    }

    // Close drawer after navigation
    setDrawerOpen(false);
  };

  const drawer = (
    <Box>
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path}
              onClick={() => handleNavigation(item.path)}
              sx={{
                '&.Mui-selected': {
                  backgroundColor: 'primary.main',
                  color: 'primary.contrastText',
                  '&:hover': {
                    backgroundColor: 'primary.dark',
                  },
                },
              }}
            >
              <ListItemIcon sx={{ color: 'inherit' }}>
                {item.icon}
              </ListItemIcon>
              <ListItemText primary={item.text} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex' }}>
      {/* App Bar */}
      <AppBar
        position="fixed"
        sx={{
          width: '100%',
          backgroundColor: 'primary.main',
          color: 'primary.contrastText',
          boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
          borderBottom: '1px solid rgba(0,0,0,0.1)',
          zIndex: theme.zIndex.drawer + 1,
        }}
      >
        <Toolbar sx={{ minHeight: '60px !important' }}>
          <IconButton
            color="inherit"
            aria-label="open drawer"
            edge="start"
            onClick={handleDrawerToggle}
            sx={{ mr: 2 }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo/Brand */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexGrow: 1 }}>
            <AutoStoriesIcon sx={{ fontSize: 20 }} />
            <Typography variant="h6" noWrap component="div" sx={{
              fontWeight: 800,
              fontSize: '1.25rem',
              ml: 0.5
            }}>
              StoryGeek
            </Typography>
            <Typography variant="caption" sx={{
              opacity: 0.9,
              fontFamily: '"Roboto Mono", monospace',
              fontSize: '1rem',
              fontWeight: 700,
              ml: 0.5
            }}>
              &lt;/&gt;
            </Typography>
          </Box>

          {/* Theme Toggle */}
          <IconButton
            onClick={onThemeToggle}
            color="inherit"
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              '&:hover': {
                backgroundColor: 'rgba(255, 255, 255, 0.2)',
              }
            }}
          >
            {isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
          </IconButton>
        </Toolbar>
      </AppBar>

      {/* Navigation Drawer - Temporary overlay */}
      <Drawer
        variant="temporary"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        ModalProps={{
          keepMounted: true, // Better open performance on mobile.
        }}
        sx={{
          '& .MuiDrawer-paper': {
            boxSizing: 'border-box',
            width: drawerWidth,
            backgroundColor: 'background.paper',
            borderRight: '1px solid',
            borderColor: 'divider',
            mt: '60px', // Position below header
            height: 'calc(100vh - 60px)', // Full height minus header
          },
        }}
      >
        {drawer}
      </Drawer>

      {/* Main content */}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: 3,
          width: '100%',
          mt: '60px', // AppBar height
          backgroundColor: 'background.default',
          minHeight: 'calc(100vh - 60px)',
        }}
      >
        <Container maxWidth="xl">
          {children}
        </Container>
      </Box>
    </Box>
  );
}

export default Layout;