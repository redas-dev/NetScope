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
public class AuthController(NetScopeDbContext db, PasswordHasher<User> hasher, TokenService tokens) : ApiControllerBase(db)
{
    [AllowAnonymous, HttpPost("register")]
    [EndpointSummary("Registracija; nauja paskyra visada turi User rolę")]
    [ProducesResponseType<TokenResponse>(201)]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        if (await Db.Users.AnyAsync(x => x.Email == email)) return Problem(statusCode: 409, title: "El. paštas jau naudojamas.");
        var user = new User { Email = email };
        user.PasswordHash = hasher.HashPassword(user, request.Password);
        Db.Users.Add(user);
        await Db.SaveChangesAsync();
        return CreatedAtAction(nameof(Me), tokens.Create(user));
    }

    [AllowAnonymous, HttpPost("login")]
    [EndpointSummary("Prisijungti ir gauti JWT su naudotojo role")]
    [ProducesResponseType<TokenResponse>(200)]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();
        var user = await Db.Users.SingleOrDefaultAsync(x => x.Email == email);
        if (user is null || hasher.VerifyHashedPassword(user, user.PasswordHash, request.Password) == PasswordVerificationResult.Failed)
            return Problem(statusCode: 401, title: "Neteisingas el. paštas arba slaptažodis.");
        return Ok(tokens.Create(user));
    }

    [HttpGet("me")]
    [EndpointSummary("Dabartinio naudotojo paskyra")]
    [ProducesResponseType<UserResponse>(200)]
    public async Task<IActionResult> Me()
    {
        var user = await Db.Users.SingleAsync(x => x.Id == CurrentUserId);
        return Ok(new UserResponse(user.Id, user.Email, user.Role));
    }

    [HttpPost("logout")]
    [EndpointSummary("Atsijungti; dabartinis JWT atšaukiamas iki jo galiojimo pabaigos")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Logout()
    {
        var id = User.FindFirstValue("jti")!;
        if (!await Db.RevokedTokens.AnyAsync(x => x.Id == id))
        {
            Db.RevokedTokens.Add(new() { Id = id, ExpiresAt = DateTimeOffset.FromUnixTimeSeconds(long.Parse(User.FindFirstValue("exp")!)).UtcDateTime });
            await Db.SaveChangesAsync();
        }
        return NoContent();
    }
}
