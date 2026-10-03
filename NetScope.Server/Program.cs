using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using NetScope.Server.Data;
using NetScope.Server.Models;
using NetScope.Server.Security;
using Npgsql;

var builder = WebApplication.CreateBuilder(args);
builder.Logging.ClearProviders();
builder.Logging.AddConsole();
builder.Configuration.AddJsonFile("appsettings.Local.json", optional: true).AddEnvironmentVariables();
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || Encoding.UTF8.GetByteCount(jwtKey) < 32)
    throw new InvalidOperationException("Set Jwt:Key to a secret of at least 32 bytes (environment variable Jwt__Key).");
builder.Services.AddDbContext<NetScopeDbContext>(options => options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
builder.Services.AddScoped<PasswordHasher<User>>();
builder.Services.AddScoped<TokenService>();
builder.Services.AddProblemDetails();
builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.UnmappedMemberHandling = JsonUnmappedMemberHandling.Disallow);
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme).AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new()
    {
        ValidateIssuer = true, ValidateAudience = true, ValidateLifetime = true, ValidateIssuerSigningKey = true,
        ValidIssuer = builder.Configuration["Jwt:Issuer"], ValidAudience = builder.Configuration["Jwt:Audience"],
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        RoleClaimType = "role", NameClaimType = "sub", ClockSkew = TimeSpan.Zero,
        ValidAlgorithms = [SecurityAlgorithms.HmacSha256]
    };
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var cookie = context.Request.Cookies[TokenService.AccessCookie];
            if (string.IsNullOrWhiteSpace(cookie)) context.NoResult();
            else context.Token = cookie;
            return Task.CompletedTask;
        },
        OnTokenValidated = async context =>
        {
            var db = context.HttpContext.RequestServices.GetRequiredService<NetScopeDbContext>();
            var subject = context.Principal?.FindFirst("sub")?.Value;
            var jti = context.Principal?.FindFirst("jti")?.Value;
            var role = context.Principal?.FindFirst("role")?.Value;
            if (!Guid.TryParse(subject, out var id) || string.IsNullOrEmpty(jti)
                || !await db.Users.AnyAsync(x => x.Id == id && x.Role == role)
                || await db.RevokedTokens.AnyAsync(x => x.Id == jti)) context.Fail("Token is no longer valid.");
        }
    };
});
builder.Services.AddAuthorization();
builder.Services.AddOpenApi(options =>
{
    options.AddDocumentTransformer((document, context, ct) =>
    {
        document.Info = new() { Title = "NetScope API", Version = "v1", Description = "Vietos, tinklo įrenginiai ir klientai. Svečias neprisijungęs; JWT rolės: User ir Admin. Prieiga per HttpOnly slapukus, 15 CRUD metodų ir paskyrų valdymas." };
        document.Components ??= new();
        document.Components.SecuritySchemes = new Dictionary<string, IOpenApiSecurityScheme>
        {
            ["AccessCookie"] = new OpenApiSecurityScheme { Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Cookie,
                Name = TokenService.AccessCookie, Description = "30 minučių JWT HttpOnly slapuke" },
            ["RefreshCookie"] = new OpenApiSecurityScheme { Type = SecuritySchemeType.ApiKey, In = ParameterLocation.Cookie,
                Name = TokenService.RefreshCookie, Description = "7 dienų atnaujinimo žetonas HttpOnly slapuke" }
        };
        foreach (var path in document.Paths)
            foreach (var operation in path.Value.Operations!.Values)
                if (path.Key is "/api/auth/refresh")
                    operation.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("RefreshCookie", document)] = [] }];
                else if (path.Key is not "/api/auth/login" and not "/api/auth/register" and not "/api/auth/logout" and not "/health")
                    operation.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference("AccessCookie", document)] = [] }];
        return Task.CompletedTask;
    });
});

var app = builder.Build();
app.UseExceptionHandler();
// The production image includes the compiled React app.
app.UseDefaultFiles();
app.UseStaticFiles();
app.Use(async (context, next) =>
{
    try { await next(context); }
    catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation } postgres)
    {
        var title = postgres.ConstraintName switch
        {
            "IX_Clients_DeviceId_MacAddress" => "Klientas su tokiu MAC adresu prie šio įrenginio jau egzistuoja.",
            "IX_Devices_LocationId_MacAddress" => "Įrenginys su tokiu MAC adresu šioje vietoje jau egzistuoja.",
            "IX_Users_Email" => "El. paštas jau naudojamas.",
            _ => "Įrašas su tokiais unikaliais duomenimis jau egzistuoja."
        };
        await Results.Problem(statusCode: 409, title: title).ExecuteAsync(context);
    }
    catch (DbUpdateConcurrencyException)
    {
        await Results.Problem(statusCode: 409, title: "Duomenys buvo pakeisti kitos užklausos. Pakartokite užklausą.").ExecuteAsync(context);
    }
    catch (DbUpdateException ex) when (ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.ForeignKeyViolation })
    {
        await Results.Problem(statusCode: 409, title: "Susijęs resursas buvo pašalintas. Pakartokite užklausą.").ExecuteAsync(context);
    }
});
app.UseStatusCodePages();
app.Use(async (context, next) =>
{
    if (context.Request.Method is not ("GET" or "HEAD" or "OPTIONS" or "TRACE")
        && context.Request.Headers.TryGetValue("Origin", out var originHeader))
    {
        var expected = $"{context.Request.Scheme}://{context.Request.Host}";
        if (!Uri.TryCreate(originHeader.ToString(), UriKind.Absolute, out var origin)
            || !string.Equals(origin.GetLeftPart(UriPartial.Authority), expected, StringComparison.OrdinalIgnoreCase))
        {
            await Results.Problem(statusCode: 403, title: "Kitos kilmės užklausa neleidžiama.").ExecuteAsync(context);
            return;
        }
    }
    await next(context);
});
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.MapOpenApi();
app.MapGet("/health", async (NetScopeDbContext db) => await db.Database.CanConnectAsync()
    ? Results.Ok(new { status = "healthy" }) : Results.Problem(statusCode: 503, title: "Database unavailable"))
    .WithSummary("API ir duomenų bazės pasiekiamumas").Produces(200).Produces<ProblemDetails>(503);
app.MapFallback(async context =>
{
    // Frontend routes need index.html on direct visits and refreshes. Keep API
    // and infrastructure paths as real 404s when no endpoint matches.
    if (context.Request.Path.StartsWithSegments("/api")
        || context.Request.Path.StartsWithSegments("/openapi")
        || context.Request.Path.StartsWithSegments("/health")
        || !(HttpMethods.IsGet(context.Request.Method) || HttpMethods.IsHead(context.Request.Method)))
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    var index = app.Environment.WebRootFileProvider.GetFileInfo("index.html");
    if (!index.Exists)
    {
        context.Response.StatusCode = StatusCodes.Status404NotFound;
        return;
    }

    context.Response.ContentType = "text/html; charset=utf-8";
    await context.Response.SendFileAsync(index);
});

if (app.Configuration.GetValue<bool>("Database:AutoMigrate"))
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<NetScopeDbContext>();
    await db.Database.MigrateAsync();
    if (app.Configuration.GetValue<bool>("Seed:DemoData")) await DemoSeeder.SeedAsync(db);
}
app.Run();

public partial class Program;
