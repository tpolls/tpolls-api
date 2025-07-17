const fetch = require('node-fetch');

async function testPollAIEndpoint() {
  try {
    console.log('Testing /api/poll-ai endpoint...');
    
    const response = await fetch('http://localhost:3000/api/poll-ai', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: 'Create a poll about favorite programming languages'
      }),
    });

    const data = await response.json();
    
    console.log('Response status:', response.status);
    console.log('Response data:', JSON.stringify(data, null, 2));
    
    if (data.success) {
      console.log('✅ Test passed! Poll generated successfully.');
      console.log('Generated poll subject:', data.data.poll.subject);
      console.log('Generated poll options:', data.data.poll.options);
    } else {
      console.log('❌ Test failed! Error:', data.message);
    }
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testPollAIEndpoint(); 