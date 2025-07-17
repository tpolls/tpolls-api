const openaiService = require('../services/openaiService');
const AiGeneratedPoll = require('../models/AiGeneratedPoll');

/**
 * Controller for poll-related endpoints
 */
const pollController = {
  /**
   * Generate options for a poll question
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generateOptions(req, res) {
    console.log('generateOptions');
    try {
      const { subject, numOptions, category } = req.body;
      
      // Validate input
      if (!subject) {
        return res.status(400).json({ 
          success: false, 
          message: 'Poll subject is required' 
        });
      }
      
      // Call OpenAI service to generate options
      const options = await openaiService.generatePollOptions(
        subject,
        category,
        numOptions || 4
      );
      
      // Return generated options
      return res.status(200).json({
        success: true,
        data: {
          question: subject,
          options
        }
      });
    } catch (error) {
      console.error('Error in generateOptions controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate poll options',
        error: error.message
      });
    }
  },

  /**
   * Generate a complete poll using AI based on a user prompt
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async generateAIPollPreview(req, res) {
    try {
      const { prompt } = req.body;
      
      // Validate input
      if (!prompt) {
        return res.status(400).json({ 
          success: false, 
          message: 'Prompt is required' 
        });
      }
      
      // Extract poll settings from the user's prompt
      const pollSettings = await openaiService.extractPollSettings(prompt);
      
      // Generate poll components using AI
      const category = await openaiService.determineCategory(prompt);
      const subject = await openaiService.generatePollSubject(prompt);
      const description = await openaiService.generateDescription(subject);
      const options = await openaiService.generatePollOptions(subject, category, 4);
      
      // Calculate target fund based on distribution type
      let targetFund;
      if (pollSettings.rewardDistribution === 'fixed') {
        // For fixed distribution, target fund = maxResponses * rewardPerResponse
        const rewardPerResponseEth = parseFloat(pollSettings.rewardPerResponse);
        targetFund = (pollSettings.maxResponses * rewardPerResponseEth).toFixed(4);
      } else {
        // For equal-share distribution, use a default target fund
        // The rewardPerResponse will be ignored in this case
        targetFund = "0.1"; // Default 0.1 ETH target fund for equal-share distribution
      }
      
      // Create poll object with extracted settings
      const poll = {
        subject,
        description,
        category,
        viewType: "text",
        options,
        rewardPerResponse: pollSettings.rewardPerResponse,
        durationDays: pollSettings.durationDays,
        maxResponses: pollSettings.maxResponses,
        minContribution: "0.0001", // Default 0.0001 ETH minimum contribution
        fundingType: pollSettings.fundingType,
        isOpenImmediately: true,
        targetFund,
        rewardToken: "0x0000000000000000000000000000000000000000", // Zero address for ETH
        rewardDistribution: pollSettings.rewardDistribution,
        originalPrompt: prompt
      };
      
      // Return generated poll
      return res.status(200).json({
        success: true,
        data: {
          poll,
          message: `Successfully generated poll: "${subject}" with ${pollSettings.maxResponses} max responses and ${pollSettings.rewardDistribution} distribution`
        }
      });
    } catch (error) {
      console.error('Error in generateAIPollPreview controller:', error);
      return res.status(500).json({
        success: false,
        message: 'Failed to generate poll preview',
        error: error.message
      });
    }
  },

  async handleAIRegeneratePollAction(req, res) {
    try {
      const { action, pollData, feedback } = req.body;

      if (action !== 'regenerate' || !pollData || !feedback) {
        return res.status(400).json({ success: false, message: 'Invalid request. Action must be "regenerate" and pollData and feedback are required.' });
      }

      // Extract poll settings from feedback if user is requesting changes to poll parameters
      // Pass existing poll settings to preserve unchanged values
      const existingSettings = {
        maxResponses: pollData.maxResponses,
        rewardPerResponse: pollData.rewardPerResponse,
        rewardDistribution: pollData.rewardDistribution,
        durationDays: pollData.durationDays,
        fundingType: pollData.fundingType,
        isOpenImmediately: pollData.isOpenImmediately
      };
      const pollSettings = await openaiService.extractPollSettings(feedback, existingSettings);
      console.log('pollSettings', pollSettings);
      
      // Regenerate poll content based on feedback
      const regeneratedParts = await openaiService.regeneratePollFromFeedback(pollData, feedback);
      
      // Calculate target fund based on distribution type
      let targetFund;
      if (pollSettings.rewardDistribution === 'fixed') {
        // For fixed distribution, target fund = maxResponses * rewardPerResponse
        const rewardPerResponseEth = parseFloat(pollSettings.rewardPerResponse);
        targetFund = (pollSettings.maxResponses * rewardPerResponseEth).toFixed(4);
      } else {
        // For equal-share distribution, use a default target fund
        // The rewardPerResponse will be ignored in this case
        targetFund = "0.1"; // Default 0.1 ETH target fund for equal-share distribution
      }

      // If the user mentioned specific target fund calculation in their feedback, use that
      if (typeof feedback === 'string' && (feedback.toLowerCase().includes('target fund') || feedback.toLowerCase().includes('multiplied by'))) {
        // Extract target fund calculation from feedback if present
        const targetFundMatch = feedback.match(/(\d+(?:\.\d+)?)\s*(?:TON|ETH).*?multiplied by\s*(\d+(?:\.\d+)?)/i);
        if (targetFundMatch) {
          const rewardPerResponse = parseFloat(targetFundMatch[1]);
          const maxResponses = parseFloat(targetFundMatch[2]);
          targetFund = (rewardPerResponse * maxResponses).toFixed(4);
        }
      }
      
      // Create new poll data with updated settings
      const newPollData = {
        ...pollData,
        subject: regeneratedParts.subject,
        description: regeneratedParts.description,
        options: regeneratedParts.options,
        category: regeneratedParts.category || pollData.category,
        // Update poll settings if they were mentioned in feedback
        maxResponses: pollSettings.maxResponses,
        rewardPerResponse: pollSettings.rewardPerResponse,
        rewardDistribution: pollSettings.rewardDistribution,
        durationDays: pollSettings.durationDays,
        fundingType: pollSettings.fundingType,
        isOpenImmediately: pollSettings.isOpenImmediately,
        targetFund
      };
      console.log('newPollData', newPollData);
      
      return res.status(200).json({ 
        success: true, 
        data: { 
          poll: newPollData,
          message: `Successfully regenerated poll with ${pollSettings.maxResponses} max responses and ${pollSettings.rewardDistribution} distribution`
        } 
      });

    } catch (error) {
      console.error('Error in handleAIRegeneratePollAction controller:', error);
      return res.status(500).json({ success: false, message: 'Failed to handle AI poll action', error: error.message });
    }
  }
};

module.exports = pollController;
