// For testing the API endpoint
const axios = require('axios');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3000;
const API_URL = `http://localhost:${PORT}/api/poll-options`;

async function testApiEndpoint() {
  try {
    console.log(`Testing API endpoint: ${API_URL}`);
    console.log('Sending request with sample poll question...');
    
    const response = await axios.post(API_URL, {
      question: 'What is your favorite programming language?',
      numOptions: 4
    });
    
    console.log('\n✅ API endpoint test successful!');
    console.log('Status:', response.status);
    console.log('Response data:');
    console.log(JSON.stringify(response.data, null, 2));
    return true;
  } catch (error) {
    console.error('\n❌ API endpoint test failed:');
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error('Response data:', error.response.data);
    } else {
      console.error(error.message);
    }
    return false;
  }
}

// Run the test
console.log('Note: Make sure the server is running before executing this test');
console.log('You can start the server with: npm start\n');

// We're not automatically running the test as it requires the server to be running
console.log('To run this test, execute: node test-api-endpoint.js');
testApiEndpoint();
