using Microsoft.OpenApi.Models;
using MsSqlVectorRag.Services;

var builder = WebApplication.CreateBuilder(args);

// Add Controllers and Swagger
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Enterprise MS SQL Vector RAG API",
        Version = "v1",
        Description = "ASP.NET Core Web API with MS SQL Server 2025 Vector Engine & Gemini AI"
    });
});

// Configure CORS for Angular Frontend (port 4200 and production hosts)
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowAngularFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:4200", "http://localhost:3000", "https://*.run.app")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Register Core Application Services
builder.Services.AddSingleton<IDocumentParserService, DocumentParserService>();
builder.Services.AddHttpClient<IGeminiService, GeminiService>();
builder.Services.AddScoped<IMsSqlVectorService, MsSqlVectorService>();

var app = builder.Build();

// Enable Swagger UI in development
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "MS SQL Vector RAG v1"));
}

app.UseCors("AllowAngularFrontend");
app.UseAuthorization();
app.MapControllers();

app.Run();
