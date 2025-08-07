const jwt = require('jsonwebtoken');
const axios = require('axios');

const BASE_GEEK_API_URL = process.env.BASE_GEEK_API_URL || 'https://basegeek.clintgeek.com/api';

const authenticateToken = async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ message: 'Authentication token required' });
  }

  try {
    // Validate token with baseGeek
    const response = await axios.post(`${BASE_GEEK_API_URL}/auth/validate`, {
      token: token,
      app: 'storygeek'
    });

    if (response.data.valid) {
      // Extract user ID from JWT token like BuJoGeek does
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = {
        ...response.data.user,
        _id: decoded.id
      };
      next();
    } else {
      return res.status(403).json({ message: 'Invalid token' });
    }
  } catch (error) {
    console.error('Token validation error:', error.response?.data || error.message);
    return res.status(403).json({ message: 'Invalid or expired token' });
  }
};

module.exports = { authenticateToken };