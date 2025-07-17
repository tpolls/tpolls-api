function getRandomDuration() {
  const durations = [1, 2, 3, 5, 10, 30, 90];
  return durations[Math.floor(Math.random() * durations.length)];
}

function getRandomMaxResponses() {
  const maxResponses = [1, 2, 3, 10, 20, 30, 100];
  return maxResponses[Math.floor(Math.random() * maxResponses.length)];
}

function getRandomPollCount() {
  const pollCounts = [2, 3, 4];
  return pollCounts[Math.floor(Math.random() * pollCounts.length)];
}

function getRandomCategory() {
  //const categories = ['technology', 'politics', 'entertainment', 'sports', 'science', 'business', 'lifestyle'];
  const categories = ['art', 'design', 'tech', 'defi', 'lifestyle', 'environment', 'web3', 'food'];
  return categories[Math.floor(Math.random() * categories.length)];
}

module.exports = {
  getRandomDuration,
  getRandomMaxResponses,
  getRandomPollCount,
  getRandomCategory
}; 