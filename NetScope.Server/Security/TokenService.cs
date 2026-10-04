using System.IdentityModel.Tokens.Jwt;
using System.Security.Cryptography;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using NetScope.Server.Contracts;
using NetScope.Server.Models;

namespace NetScope.Server.Security;

public class TokenService(IConfiguration configuration)
{
    public const string AccessCookie = "netscope_access";
    public const string RefreshCookie = "netscope_refresh";
    public static readonly TimeSpan RefreshLifetime = TimeSpan.FromDays(7);

    public (string Value, DateTime ExpiresAt) Create(User user)
    {
        var expires = DateTime.UtcNow.AddMinutes(30);
        var claims = new[] { new Claim("sub", user.Id.ToString()), new Claim("email", user.Email),
            new Claim("role", user.Role), new Claim("jti", Guid.NewGuid().ToString()) };
        var jwt = new JwtSecurityToken(configuration["Jwt:Issuer"], configuration["Jwt:Audience"], claims,
            DateTime.UtcNow, expires, new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));

        return (new JwtSecurityTokenHandler().WriteToken(jwt), expires);
    }

    public static string NewRefreshToken() => Microsoft.AspNetCore.WebUtilities.WebEncoders.Base64UrlEncode(RandomNumberGenerator.GetBytes(48));

    public static string HashRefreshToken(string value) => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(value)));

    public static void SetCookies(HttpResponse response, IHostEnvironment environment, string accessToken, DateTime accessExpires,
        string refreshToken, DateTime refreshExpires)
    {
        var secure = !environment.IsDevelopment();
        response.Cookies.Append(AccessCookie, accessToken, new CookieOptions
        {
            HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/", Expires = new DateTimeOffset(accessExpires)
        });
        response.Cookies.Append(RefreshCookie, refreshToken, new CookieOptions
        {
            HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/api/auth", Expires = new DateTimeOffset(refreshExpires)
        });
        response.Headers.CacheControl = "no-store";
    }

    public static void ClearCookies(HttpResponse response, IHostEnvironment environment)
    {
        var secure = !environment.IsDevelopment();
        response.Cookies.Delete(AccessCookie, new CookieOptions { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/" });
        response.Cookies.Delete(RefreshCookie, new CookieOptions { HttpOnly = true, Secure = secure, SameSite = SameSiteMode.Strict, Path = "/api/auth" });
        response.Headers.CacheControl = "no-store";
    }
}
