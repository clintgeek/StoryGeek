import React from 'react';
import { Box, Typography, Card, CardContent } from '@mui/material';

function Settings() {
  return (
    <Box>
      <Typography variant="h4" gutterBottom>
        Settings
      </Typography>

      <Card>
        <CardContent>
          <Typography variant="body1">
            Settings and configuration options coming soon.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default Settings;