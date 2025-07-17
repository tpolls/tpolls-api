# Poll Options API Documentation

## Overview
This Node.js backend REST API generates poll options using OpenAI's API. It's designed to be called from a React.js frontend and provides creative options for poll questions.

## API Endpoint
- **URL**: https://3000-iah2xviw200igc9cfzjz5-7a02b86e.manusvm.computer/api/poll-options
- **Method**: POST
- **Content-Type**: application/json

## Request Format
```json
{
  "question": "What is your favorite programming language?",
  "numOptions": 4
}
```

### Parameters
- `question` (required): The poll question for which options should be generated
- `numOptions` (optional): Number of options to generate (default: 4)

## Response Format
```json
{
  "success": true,
  "data": {
    "question": "What is your favorite programming language?",
    "options": [
      "JavaScript",
      "Python",
      "Java",
      "C++"
    ]
  }
}
```

## Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error information"
}
```

## Setup Instructions
1. Clone or download the project files
2. Navigate to the project directory: `cd poll-options-api`
3. Install dependencies: `npm install`
4. Create a `.env` file with your OpenAI API key:
   ```
   PORT=3000
   OPENAI_API_KEY=your_openai_api_key_here
   ALLOWED_ORIGINS=http://localhost:3000,http://your-frontend-domain.com
   ```
5. Start the server: `npm start`

## Integration with React Frontend
Example code for calling the API from your React frontend:

```javascript
import axios from 'axios';

const API_URL = 'https://3000-iah2xviw200igc9cfzjz5-7a02b86e.manusvm.computer/api/poll-options';

async function generatePollOptions(question, numOptions = 4) {
  try {
    const response = await axios.post(API_URL, {
      question,
      numOptions
    });
    
    return response.data.data.options;
  } catch (error) {
    console.error('Error generating poll options:', error);
    throw error;
  }
}

// Usage example
generatePollOptions('What is your favorite weekend activity?')
  .then(options => {
    console.log('Generated options:', options);
    // Update your React component state with these options
  })
  .catch(error => {
    // Handle error
  });
```

## Important Notes
- The exposed API URL is temporary and will expire after some time
- For production use, deploy the API to a permanent hosting service
- Remember to secure your OpenAI API key and not expose it in frontend code
