using System.ComponentModel.DataAnnotations;
using System.Net;

namespace NetScope.Server.Contracts;

public class IpAddressAttribute : ValidationAttribute
{
    public override bool IsValid(object? value) => value is string text && IPAddress.TryParse(text, out _);
}

public record RegisterRequest(
    [Required, EmailAddress, StringLength(254)] string Email,
    [Required, StringLength(128, MinimumLength = 10)] string Password);
public record LoginRequest([Required, EmailAddress] string Email, [Required, StringLength(128)] string Password);
public record LocationRequest(
    [Required, StringLength(120, MinimumLength = 2)] string Name,
    [Required, StringLength(250)] string Address,
    [StringLength(1000)] string? Description);
public record DeviceRequest(
    [Required, StringLength(120, MinimumLength = 2)] string Name,
    [Required, RegularExpression("^(Router|Switch|AccessPoint|Firewall|Other)$")] string Type,
    [Required, IpAddress] string IpAddress,
    [Required, RegularExpression("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")] string MacAddress,
    [Required, RegularExpression("^(Online|Offline|Maintenance)$")] string Status);
public record ClientRequest(
    [Required, StringLength(120, MinimumLength = 2)] string Name,
    [Required, RegularExpression("^(Computer|Phone|Tablet|Printer|Other)$")] string Type,
    [Required, IpAddress] string IpAddress,
    [Required, RegularExpression("^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$")] string MacAddress);
public class ListQuery
{
    [StringLength(120)] public string? Search { get; set; }
    [Range(1, 1000000)] public int Page { get; set; } = 1;
    [Range(1, 100)] public int PageSize { get; set; } = 20;
}
public record PageResult<T>(IReadOnlyList<T> Items, int Total, int Page, int PageSize);
public record UserResponse(Guid Id, string Email, string Role);
public record TokenResponse(string AccessToken, string TokenType, DateTime ExpiresAt, UserResponse User);
public record LocationResponse(Guid Id, string Name, string Address, string? Description, Guid OwnerId, DateTime CreatedAt);
public record DeviceResponse(Guid Id, Guid LocationId, string Name, string Type, string IpAddress, string MacAddress, string Status);
public record ClientResponse(Guid Id, Guid DeviceId, string Name, string Type, string IpAddress, string MacAddress);
