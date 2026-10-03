# Solution 2: .NET 9 Web API & MS SQL Server 2025 Vector Engine

## Overview
This ASP.NET Core 9 Web API handles:
1. **Document Upload & Vectorization**: Uploads PDF, Word (.docx), or text files, parses and chunks them, generates 768-d vector embeddings using Gemini, and pushes them to your local/public MS SQL Server.
2. **Agent RAG Query Workflow**: When the user chats with the agent, it converts the query to a vector, searches MS SQL Server using `VECTOR_DISTANCE('cosine')`, feeds the retrieved chunks to Gemini 3.8 Flash, and sends back grounded responses and clarifying questions to the Angular app.

## Quick Start

### 1. Database Setup (MS SQL Server 2025)
Open SQL Server Management Studio (SSMS) or Azure Data Studio and run:
```sql
Database/Schema.sql
```
This creates the `EnterpriseVectorDb` database with `VECTOR(768)` columns and `DiskANN` vector indexing.

### 2. Configure Connection String
Edit `appsettings.json`:
```json
"ConnectionStrings": {
  "MsSqlVectorDb": "Server=localhost,1433;Database=EnterpriseVectorDb;User Id=sa;Password=YourPassword123!;TrustServerCertificate=True;"
},
"Gemini": {
  "ApiKey": "YOUR_GEMINI_API_KEY"
}
```

### 3. Run the API
```bash
dotnet restore
dotnet run
```
The API will launch at `http://localhost:5000` with Swagger UI at `http://localhost:5000/swagger`.
