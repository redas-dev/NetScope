using Microsoft.EntityFrameworkCore;
using NetScope.Server.Models;

namespace NetScope.Server.Data;

public class NetScopeDbContext(DbContextOptions<NetScopeDbContext> options) : DbContext(options)
{
    public DbSet<User> Users => Set<User>();
    public DbSet<Location> Locations => Set<Location>();
    public DbSet<NetworkDevice> Devices => Set<NetworkDevice>();
    public DbSet<NetworkClient> Clients => Set<NetworkClient>();
    public DbSet<RevokedToken> RevokedTokens => Set<RevokedToken>();

    protected override void OnModelCreating(ModelBuilder model)
    {
        model.Entity<User>().HasIndex(x => x.Email).IsUnique();
        model.Entity<User>().Property(x => x.Email).HasMaxLength(254);
        model.Entity<Location>().HasOne(x => x.Owner).WithMany().HasForeignKey(x => x.OwnerId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<NetworkDevice>().HasOne(x => x.Location).WithMany().HasForeignKey(x => x.LocationId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<NetworkClient>().HasOne(x => x.Device).WithMany().HasForeignKey(x => x.DeviceId).OnDelete(DeleteBehavior.Cascade);
        model.Entity<NetworkDevice>().HasIndex(x => new { x.LocationId, x.MacAddress }).IsUnique();
        model.Entity<NetworkClient>().HasIndex(x => new { x.DeviceId, x.MacAddress }).IsUnique();
    }
}
