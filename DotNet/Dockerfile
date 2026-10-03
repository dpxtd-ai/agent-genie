# Stage 1: Build the .NET 9 Web API
FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src
COPY ["MsSqlVectorRag.csproj", "./"]
RUN dotnet restore "MsSqlVectorRag.csproj"
COPY . .
RUN dotnet build "MsSqlVectorRag.csproj" -c Release -o /app/build
RUN dotnet publish "MsSqlVectorRag.csproj" -c Release -o /app/publish /p:UseAppHost=false

# Stage 2: Runtime image
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final
WORKDIR /app
COPY --from=build /app/publish .
ENV ASPNETCORE_URLS=http://+:5000
EXPOSE 5000
ENTRYPOINT ["dotnet", "MsSqlVectorRag.dll"]
