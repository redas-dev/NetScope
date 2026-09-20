using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using NetScope.Server.Contracts;
using NetScope.Server.Models;

namespace NetScope.Server.Security;

public class TokenService(IConfiguration configuration)
{
    public TokenResponse Create(User user)
    {
        var expires = DateTime.UtcNow.AddMinutes(30);
        var claims = new[] { new Claim("sub", user.Id.ToString()), new Claim("email", user.Email),
            new Claim("role", user.Role), new Claim("jti", Guid.NewGuid().ToString()) };
        var jwt = new JwtSecurityToken(configuration["Jwt:Issuer"], configuration["Jwt:Audience"], claims,
            DateTime.UtcNow, expires, new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(configuration["Jwt:Key"]!)), SecurityAlgorithms.HmacSha256));
        return new(new JwtSecurityTokenHandler().WriteToken(jwt), "Bearer", expires, new(user.Id, user.Email, user.Role));
    }
}
