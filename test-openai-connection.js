// For testing OpenAI API connection
const { OpenAI } = require('openai');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Check if OpenAI API key is set
if (!process.env.OPENAI_API_KEY) {
  console.error('Error: OPENAI_API_KEY is not set in environment variables');
  console.log('Please create a .env file with your OpenAI API key');
  process.exit(1);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Test function
async function testOpenAIConnection() {
  try {
    console.log('Testing OpenAI API connection...');
    
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant."
        },
        {
          role: "user",
          content: "Generate 2 sample poll options for 'Favorite programming language'"
        }
      ],
      max_tokens: 50
    });
    
    console.log('OpenAI API connection successful!');
    console.log('Sample response:');
    console.log(response.choices[0].message.content);
    return true;
  } catch (error) {
    console.error('OpenAI API connection failed:');
    console.error(error.message);
    return false;
  }
}

// Run the test
testOpenAIConnection()
  .then(success => {
    if (success) {
      console.log('✅ OpenAI API integration is working correctly');
    } else {
      console.log('❌ OpenAI API integration test failed');
    }
  })
  .catch(err => {
    console.error('Unexpected error during test:', err);
  });
