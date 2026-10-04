using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Contracts;
using NetScope.Server.Data;
using NetScope.Server.Models;
using NetScope.Server.Security;

namespace NetScope.Server.Controllers;

[Route("api/auth")]
public class AuthController(NetScopeDbContext db, PasswordHasher<User> hasher, TokenService tokens, IHostEnvironment environment) : ApiControllerBase(db)
{
    [AllowAnonymous, HttpPost("register")]
    [EndpointSummary("Registracija; nauja paskyra visada turi User rolę")]
    [ProducesResponseType<SessionResponse>(201)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await Db.Users.AnyAsync(x => x.Email == email)) return Problem(statusCode: 409, title: "El. paštas jau naudojamas.");

        var user = new User { Email = email };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();

        return CreatedAtAction(nameof(Me), await IssueSession(user));
    }

    [AllowAnonymous, HttpPost("login")]
    [EndpointSummary("Prisijungti ir gauti JWT su naudotojo role")]
    [ProducesResponseType<SessionResponse>(200)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await Db.Users.SingleOrDefaultAsync(x => x.Email == email);

        if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            return Problem(statusCode: 401, title: "Neteisingas el. paštas arba slaptažodis.");

        return Ok(await IssueSession(user));
    }

    [AllowAnonymous, HttpPost("refresh")]
    [EndpointSummary("Pakeisti ilgalaikį refresh žetoną ir išduoti naują JWT slapukuose")]
    [ProducesResponseType<SessionResponse>(200)]
    public async Task<IActionResult> Refresh()
    {
        var raw = Request.Cookies[TokenService.RefreshCookie];
        if (string.IsNullOrWhiteSpace(raw)) return Problem(statusCode: 401, title: "Atnaujinimo žetono nėra.");

        var hash = TokenService.HashRefreshToken(raw);
        var now = DateTime.UtcNow;
        var current = await Db.RefreshTokens.AsNoTracking().Include(x => x.User)
            .SingleOrDefaultAsync(x => x.TokenHash == hash && x.ExpiresAt > now);
        if (current is null)
        {
            TokenService.ClearCookies(Response, environment);

            return Problem(statusCode: 401, title: "Atnaujinimo žetonas nebegalioja.");
        }

        await using var transaction = await Db.Database.BeginTransactionAsync();
        var consumed = await Db.RefreshTokens.Where(x => x.TokenHash == hash && x.ExpiresAt > now).ExecuteDeleteAsync();

        if (consumed != 1) return Problem(statusCode: 401, title: "Atnaujinimo žetonas jau panaudotas.");

        var nextRefresh = TokenService.NewRefreshToken();
        var refreshExpires = now.Add(TokenService.RefreshLifetime);
        Db.RefreshTokens.Add(new RefreshToken
        {
            UserId = current.UserId, TokenHash = TokenService.HashRefreshToken(nextRefresh), ExpiresAt = refreshExpires
        });
        await Db.SaveChangesAsync();
        await transaction.CommitAsync();
        var access = tokens.Create(current.User);
        TokenService.SetCookies(Response, environment, access.Value, access.ExpiresAt, nextRefresh, refreshExpires);

        return Ok(new SessionResponse(new(current.User.Id, current.User.Email, current.User.Role), access.ExpiresAt));
    }

    [HttpGet("me")]
    [EndpointSummary("Dabartinio naudotojo paskyra")]
    [ProducesResponseType<UserResponse>(200)]
    public async Task<IActionResult> Me()
    {
        var user = await Db.Users.SingleAsync(x => x.Id == CurrentUserId);

        return Ok(new UserResponse(user.Id, user.Email, user.Role));
    }

    [AllowAnonymous, HttpPost("logout")]
    [EndpointSummary("Atsijungti; atšaukti dabartinį JWT ir refresh žetoną")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Logout()
    {
        var raw = Request.Cookies[TokenService.RefreshCookie];
        if (!string.IsNullOrWhiteSpace(raw))
            await Db.RefreshTokens.Where(x => x.TokenHash == TokenService.HashRefreshToken(raw)).ExecuteDeleteAsync();
        var id = User.FindFirstValue("jti");
        if (id is not null && !await Db.RevokedTokens.AnyAsync(x => x.Id == id))
        {
            Db.RevokedTokens.Add(new() { Id = id, ExpiresAt = DateTimeOffset.FromUnixTimeSeconds(long.Parse(User.FindFirstValue("exp")!)).UtcDateTime });
            await Db.SaveChangesAsync();
        }
        TokenService.ClearCookies(Response, environment);

        return NoContent();
    }

    private async Task<SessionResponse> IssueSession(User user)
    {
        var previous = Request.Cookies[TokenService.RefreshCookie];
        if (!string.IsNullOrWhiteSpace(previous))
            await Db.RefreshTokens.Where(x => x.TokenHash == TokenService.HashRefreshToken(previous)).ExecuteDeleteAsync();
        var refresh = TokenService.NewRefreshToken();
        var refreshExpires = DateTime.UtcNow.Add(TokenService.RefreshLifetime);
        Db.RefreshTokens.Add(new RefreshToken
        {
            UserId = user.Id, TokenHash = TokenService.HashRefreshToken(refresh), ExpiresAt = refreshExpires
        });
        await Db.SaveChangesAsync();
        var access = tokens.Create(user);
        TokenService.SetCookies(Response, environment, access.Value, access.ExpiresAt, refresh, refreshExpires);

        return new SessionResponse(new(user.Id, user.Email, user.Role), access.ExpiresAt);
    }
}
