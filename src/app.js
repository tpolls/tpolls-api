const express = require('express');
const cors = require('cors');
const config = require('./config/config');
const pollRoutes = require('./routes/pollRoutes');
const blockchainRoutes = require('./routes/blockchainRoutes');
const tonService = require('./services/tonService');
const syncService = require('./services/blockchainSyncService');

// Initialize Express app
const app = express();

// Middleware
app.use(express.json());
app.use(cors({
  origin: config.allowedOrigins,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
}));

// Initialize services on startup
tonService.init().then((success) => {
  if (success) {
    console.log('TON service initialized successfully');
    
    // Start blockchain sync service after TON service is ready
    syncService.start();
  } else {
    console.warn('TON service initialization failed - running in fallback mode');
  }
}).catch((error) => {
  console.error('TON service initialization error:', error);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  syncService.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  syncService.stop();
  process.exit(0);
});

// Routes
app.use('/api', pollRoutes);
app.use('/api/blockchain', blockchainRoutes);

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
