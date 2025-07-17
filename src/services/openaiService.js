const { OpenAI } = require('openai');
const config = require('../config/config');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: config.openaiApiKey
});

/**
 * Generate poll options based on a given question
 * @param {string} question - The poll question
 * @param {number} numOptions - Number of options to generate (default: 4)
 * @returns {Promise<Array<string>>} - Array of generated poll options
 */
async function generatePollOptions(question, category, numOptions = 4) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates creative and diverse options for poll questions."
        },
        {
          role: "user",
          content: category ? `Generate ${numOptions} distinct options for the following poll question: "${question} under the category ${category}". 
                    Return only the options as a JSON array of strings, with no additional text.`
                    :
                    `Generate ${numOptions} distinct options for the following poll question: "${question}". 
                    Return only the options as a JSON array of strings, with no additional text.`
        }
      ],
      temperature: 0.7,
      max_tokens: 250,
      response_format: { type: "json_object" }
    });

    // Parse the JSON response
    const content = response.choices[0].message.content;
    const parsedContent = JSON.parse(content);
    
    // Ensure we have an array of options
    if (Array.isArray(parsedContent.options)) {
      return parsedContent.options;
    } else {
      throw new Error('Invalid response format from OpenAI API');
    }
  } catch (error) {
    console.error('Error generating poll options:', error);
    throw error;
  }
}

/**
 * Generate a creative poll subject based on a category
 * @param {string} category - The category to generate a subject for
 * @returns {Promise<string>} - Generated poll subject
 */
async function generatePollSubject(category) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates creative and engaging poll subjects."
        },
        {
          role: "user",
          content: `Generate a creative and engaging poll subject in the category of ${category}. 
                   The subject should be relevant to ${category} and encourage community participation.
                   Return only the subject as a string, with no additional text.`
        }
      ],
      temperature: 0.8,
      max_tokens: 100
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating poll subject:', error);
    throw error;
  }
}

/**
 * Generate a poll description based on the subject
 * @param {string} subject - The poll subject to generate description for
 * @returns {Promise<string>} - Generated poll description
 */
async function generateDescription(subject) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that generates engaging and relevant poll descriptions."
        },
        {
          role: "user",
          content: `Generate a concise and engaging description for a poll with the subject: "${subject}". 
                   The description should encourage participation and be relevant to the subject.
                   Return only the description as a string, with no additional text.`
        }
      ],
      temperature: 0.7,
      max_tokens: 150
    });

    return response.choices[0].message.content.trim();
  } catch (error) {
    console.error('Error generating poll description:', error);
    throw error;
  }
}

/**
 * Determine the appropriate category for a poll subject
 * @param {string} subject - The poll subject to categorize
 * @returns {Promise<string>} - The determined category
 */
async function determineCategory(subject) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that categorizes poll subjects into one of these categories: Art, Design, Technology, DeFi, Lifestyle, Environment, Web3, Food. Choose the most appropriate category based on the subject matter."
        },
        {
          role: "user",
          content: `Determine the most appropriate category for this poll subject: "${subject}". 
                   Return only the category name as a string, with no additional text.
                   The category must be one of: Art, Design, Technology, DeFi, Lifestyle, Environment, Web3, Food.`
        }
      ],
      temperature: 0.3,
      max_tokens: 50
    });

    const category = response.choices[0].message.content.trim().toLowerCase();
    // Validate that the returned category is one of the allowed values
    const validCategories = ['art', 'design', 'tech', 'defi', 'lifestyle', 'environment', 'web3', 'food'];
    if (!validCategories.includes(category)) {
      return 'other'; // Default to General if the response is invalid
    }
    return category;
  } catch (error) {
    console.error('Error determining category:', error);
    return 'other'; // Default to General in case of error
  }
}

async function regeneratePollFromFeedback(previousPoll, feedback) {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that regenerates poll data based on user feedback. You will be given a JSON object of the previous poll and user feedback. You must return a complete JSON object for the new poll, maintaining the same structure."
        },
        {
          role: "user",
          content: `Here is the previous poll data: ${JSON.stringify(previousPoll)}. \n\nHere is the user feedback for regeneration: "${feedback}". \n\nPlease generate a new poll based on this feedback. The category should likely remain '${previousPoll.category}' unless the user explicitly asks for a different category. The output must be a single JSON object with the same structure as the input poll, containing fields like "subject", "description", and "options". Do not include any extra text or explanation.`
        }
      ],
      temperature: 0.7,
      max_tokens: 500,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsedContent = JSON.parse(content);
    
    // simple validation
    if (parsedContent.subject && parsedContent.description && Array.isArray(parsedContent.options)) {
      return parsedContent;
    } else {
      throw new Error('Invalid response format from OpenAI API during regeneration');
    }
  } catch (error) {
    console.error('Error regenerating poll from feedback:', error);
    throw error;
  }
}

/**
 * Extract poll settings from user prompt
 * @param {string} prompt - The user's prompt
 * @param {Object} existingSettings - Optional existing poll settings to preserve unchanged values
 * @returns {Promise<Object>} - Extracted poll settings
 */
async function extractPollSettings(prompt, existingSettings = null) {
  try {
    // Prepare the context for the AI
    let contextMessage = "";
    let systemMessage = "";
    
    if (existingSettings) {
      // If we have existing settings, we want to preserve unchanged values
      systemMessage = "You are a helpful assistant that extracts poll settings from user prompts. You will be given existing poll settings and user feedback. You must return a JSON object with the following structure: { maxResponses: number, rewardPerResponse: string, rewardDistribution: string, durationDays: number, fundingType: string, isOpenImmediately: boolean }. CRITICAL: Only change the settings that are explicitly mentioned in the user's feedback. Keep all other settings exactly as they are in the existing settings. The rewardDistribution must be either 'equal-share' or 'fixed'. If the user specifies a reward per response, set rewardDistribution to 'fixed'. If the user specifies 'equal-share', set rewardDistribution to 'equal-share'. The fundingType must be either 'self-funded' or 'crowdfunded'. The isOpenImmediately should be true for self-funded polls and false for crowdfunded polls. Do not mention or set any field named targetFund.";
      
      contextMessage = `Here are the existing poll settings: ${JSON.stringify(existingSettings)}. \n\nUser feedback: "${prompt}". \n\nAnalyze the user feedback for any mentions of changes to:
                   - Number of responses (maxResponses)
                   - Reward amount per response (rewardPerResponse in ETH as string)
                   - Distribution type (rewardDistribution: 'equal-share' or 'fixed')
                   - Duration in days (durationDays)
                   - Funding type (fundingType: 'self-funded' or 'crowdfunded')
                   
                   CRITICAL RULES:
                   1. Only change the settings that are explicitly mentioned in the user feedback
                   2. For all other settings, use the exact values from the existing settings
                   3. Do not make assumptions or changes to settings not mentioned
                   4. If the user mentions changing distribution type to 'fixed' and specifies a reward amount, update both rewardDistribution to 'fixed' and rewardPerResponse
                   5. If the user mentions changing distribution type to 'equal-share', update rewardDistribution accordingly
                   6. If the user mentions specific numbers for maxResponses, durationDays, or fundingType, update only those specific fields
                   7. If the user specifies a reward per response, set rewardDistribution to 'fixed'.
                   8. Do not mention or set any field named targetFund.
                   
                   Examples:
                   - If user says "Duration should be 90 days" → only change durationDays to 90, keep everything else the same
                   - If user says "Change to fixed distribution with 0.00001 TON per response" → change rewardDistribution to "fixed" and rewardPerResponse to "0.00001", keep everything else the same
                   
                   Return only a JSON object with all six fields, preserving existing values for unchanged settings.`;
    } else {
      // If no existing settings, use the original logic for new polls
      systemMessage = "You are a helpful assistant that extracts poll settings from user prompts. You must return a JSON object with the following structure: { maxResponses: number, rewardPerResponse: string, rewardDistribution: string, durationDays: number, fundingType: string, isOpenImmediately: boolean }. The rewardDistribution must be either 'equal-share' or 'fixed'. If the user specifies a reward per response, set rewardDistribution to 'fixed'. If the user specifies 'equal-share', set rewardDistribution to 'equal-share'. The fundingType must be either 'self-funded' or 'crowdfunded'. The isOpenImmediately should be true for self-funded polls and false for crowdfunded polls. If the user mentions specific numbers for responses, rewards, duration, or funding preferences, use those. Otherwise, make reasonable estimates based on the context. Do not mention or set any field named targetFund.";
      
      contextMessage = `Extract poll settings from this user prompt: "${prompt}". 
                   Analyze the prompt for any mentions of:
                   - Number of responses (maxResponses)
                   - Reward amount per response (rewardPerResponse in ETH as string)
                   - Distribution type (rewardDistribution: 'equal-share' or 'fixed')
                   - Duration in days (durationDays)
                   - Funding type (fundingType: 'self-funded' or 'crowdfunded')
                   - Whether to open immediately (isOpenImmediately: true for self-funded, false for crowdfunded)
                   
                   If not specified, use these defaults:
                   - maxResponses: 100
                   - rewardPerResponse: "0.001"
                   - rewardDistribution: "equal-share"
                   - durationDays: 7
                   - fundingType: "self-funded"
                   - isOpenImmediately: true (for self-funded) or false (for crowdfunded)
                   
                   If the user specifies a reward per response, set rewardDistribution to 'fixed'.
                   Do not mention or set any field named targetFund.
                   
                   Return only a JSON object with these six fields.`;
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: systemMessage
        },
        {
          role: "user",
          content: contextMessage
        }
      ],
      temperature: 0.3,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const content = response.choices[0].message.content;
    const parsedContent = JSON.parse(content);
    
    // Validate the response
    if (typeof parsedContent.maxResponses === 'number' && 
        typeof parsedContent.rewardPerResponse === 'string' && 
        ['equal-share', 'fixed'].includes(parsedContent.rewardDistribution) &&
        typeof parsedContent.durationDays === 'number' &&
        ['self-funded', 'crowdfunded'].includes(parsedContent.fundingType) &&
        typeof parsedContent.isOpenImmediately === 'boolean') {
      
      // Ensure isOpenImmediately is set correctly based on funding type
      const settings = { ...parsedContent };
      if (settings.fundingType === 'crowdfunded') {
        settings.isOpenImmediately = false;
      }
      
      return settings;
    } else {
      throw new Error('Invalid response format from OpenAI API for poll settings');
    }
  } catch (error) {
    console.error('Error extracting poll settings:', error);
    
    if (existingSettings) {
      // If we have existing settings, return them unchanged in case of error
      return existingSettings;
    } else {
      // Return default settings in case of error for new polls
      return {
        maxResponses: 100,
        rewardPerResponse: "0.001",
        rewardDistribution: "equal-share",
        durationDays: 7,
        fundingType: "self-funded",
        isOpenImmediately: true
      };
    }
  }
}

module.exports = {
  generatePollOptions,
  generatePollSubject,
  generateDescription,
  determineCategory,
  regeneratePollFromFeedback,
  extractPollSettings
};
