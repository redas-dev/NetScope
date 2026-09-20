FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY NetScope.Server/NetScope.Server.csproj NetScope.Server/
RUN dotnet restore NetScope.Server/NetScope.Server.csproj
COPY NetScope.Server/ NetScope.Server/
RUN dotnet publish NetScope.Server/NetScope.Server.csproj -c Release -o /app --no-restore
FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app .
USER $APP_UID
EXPOSE 8080
ENTRYPOINT ["dotnet", "NetScope.Server.dll"]
