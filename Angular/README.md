# Solution 1: Angular 19 UI Application

## Overview
This Angular 19 application provides the frontend interface for the enterprise RAG system:
- **Tab 1: Upload Files**: Browse PDF, Word (.docx), or text files. The file is uploaded to the .NET API, converted into vector data format, and stored into MS SQL Server.
- **Tab 2: Agent Q&A (Vector + Gemini)**: Communicate with the Agent. The backend first converts the question to a vector, hits the local/public MS SQL Server to compare with existing vectors, sends the context to Gemini LLM, and displays the response with citations and clarifying questions.

## Running the Angular App

### 1. Install Dependencies
```bash
cd Angular
npm install
```

### 2. Start Dev Server
```bash
npm start
# or ng serve --port 4200
```
Open `http://localhost:4200` in your browser.
Ensure your .NET API is running on port 5000 (or configure the URL in `src/app/services/rag-api.service.ts`).
