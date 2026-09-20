namespace NetScope.Server.Models;

public class User
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Email { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string Role { get; set; } = "User";
}

public class Location
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string Name { get; set; } = "";
    public string Address { get; set; } = "";
    public string? Description { get; set; }
    public Guid OwnerId { get; set; }
    public User Owner { get; set; } = null!;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class NetworkDevice
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LocationId { get; set; }
    public Location Location { get; set; } = null!;
    public string Name { get; set; } = "";
    public string Type { get; set; } = "Router";
    public string IpAddress { get; set; } = "";
    public string MacAddress { get; set; } = "";
    public string Status { get; set; } = "Online";
}

public class NetworkClient
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DeviceId { get; set; }
    public NetworkDevice Device { get; set; } = null!;
    public string Name { get; set; } = "";
    public string Type { get; set; } = "Computer";
    public string IpAddress { get; set; } = "";
    public string MacAddress { get; set; } = "";
}

public class RevokedToken
{
    public string Id { get; set; } = "";
    public DateTime ExpiresAt { get; set; }
}
