# Deploying to Render

This guide will walk you through deploying your Node.js backend REST API to Render for permanent hosting.

## Prerequisites
- A [Render account](https://render.com/) (free tier available)
- A GitHub, GitLab, or Bitbucket account to host your code repository

## Deployment Steps

### 1. Prepare Your Repository
1. Create a new repository on GitHub/GitLab/Bitbucket
2. Push your code to the repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin YOUR_REPOSITORY_URL
   git push -u origin main
   ```

### 2. Deploy on Render
1. Log in to your [Render Dashboard](https://dashboard.render.com/)
2. Click on "New +" and select "Web Service"
3. Connect your GitHub/GitLab/Bitbucket account and select your repository
4. Configure your service:
   - **Name**: poll-options-api (or your preferred name)
   - **Environment**: Node
   - **Region**: Choose the region closest to your users
   - **Branch**: main (or your default branch)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (or select a paid plan for more resources)

### 3. Configure Environment Variables
1. In the Render dashboard, go to your service settings
2. Navigate to the "Environment" tab
3. Add the following environment variables:
   - `PORT`: 10000 (Render will automatically assign the correct port)
   - `OPENAI_API_KEY`: Your OpenAI API key
   - `ALLOWED_ORIGINS`: Comma-separated list of allowed origins (e.g., `https://your-frontend-domain.com,https://www.your-frontend-domain.com`)

### 4. Deploy
1. Click "Create Web Service"
2. Render will automatically build and deploy your application
3. Once deployment is complete, you'll receive a permanent URL (e.g., `https://poll-options-api.onrender.com`)

## Updating Your Application
Any new commits pushed to your repository will trigger automatic redeployment on Render.

## Connecting Your React Frontend
Update your frontend code to use the new permanent Render URL:

```javascript
const API_URL = 'https://your-app-name.onrender.com/api/poll-options';
```

## Monitoring and Logs
You can monitor your application and view logs from the Render dashboard.

## Important Notes
- The free tier of Render may have some limitations:
  - Services on the free tier will spin down after 15 minutes of inactivity
  - The first request after inactivity may take a few seconds to respond
- For production use, consider upgrading to a paid plan for better performance and reliability
