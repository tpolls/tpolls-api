const app = require('./app');
const config = require('./config/config');
const { connectDB } = require('./config/database');

// Connect to MongoDB
connectDB();

// Start the server
const PORT = config.port;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});
