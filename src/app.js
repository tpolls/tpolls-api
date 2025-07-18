const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const pollRoutes = require('./routes/pollRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');
const simpleBlockchainRoutes = require('./routes/simpleBlockchainRoutes');
const simpleTonService = require('./services/simpleTonService');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Initialize simplified TON service
simpleTonService.init().then((success) => {
  if (success) {
    console.log('Simple TON service initialized successfully');
  } else {
    console.warn('Simple TON service initialization failed');
  }
}).catch((error) => {
  console.error('Simple TON service initialization error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

// Routes
app.use('/api', pollRoutes);
app.use('/api/blockchain', blockchainRoutes);
app.use('/api/simple-blockchain', simpleBlockchainRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', message: 'Server is running' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'production' ? null : err.message
  });
});

module.exports = app;
