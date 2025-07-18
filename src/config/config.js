require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  openaiApiKey: process.env.OPENAI_API_KEY,
  mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/tpolls-ai',
  allowedOrigins: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : ['http://localhost:3000'],
  
  // TON Blockchain Configuration
  ton: {
    network: process.env.TON_NETWORK || 'testnet',
    endpoint: process.env.TONCENTER_ENDPOINT || 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY,
    contractAddress: process.env.TPOLLS_CONTRACT_ADDRESS || 'EQALr5-FARSMfmifCqViREbvSGpQnz9I4-ld9OUM8Tj2Qn7B'
  },
  
  // Blockchain Sync Configuration
  sync: {
    intervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES) || 5,
    maxRegistrationAttempts: parseInt(process.env.MAX_REGISTRATION_ATTEMPTS) || 3,
    confirmationBlocks: parseInt(process.env.BLOCKCHAIN_CONFIRMATION_BLOCKS) || 3
  }
};
