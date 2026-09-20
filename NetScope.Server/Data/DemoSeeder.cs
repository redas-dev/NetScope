using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Models;

namespace NetScope.Server.Data;

public static class DemoSeeder
{
    public static async Task SeedAsync(NetScopeDbContext db)
    {
        if (await db.Users.AnyAsync()) return;
        var hasher = new PasswordHasher<User>();
        var admin = new User { Email = "admin@netscope.local", Role = "Admin" };
        var owner = new User { Email = "redas@netscope.local" };
        var other = new User { Email = "ieva@netscope.local" };
        foreach (var user in new[] { admin, owner, other }) user.PasswordHash = hasher.HashPassword(user, "NetScopeDemo!2026");
        var lab = new Location { Name = "KTU tinklų laboratorija", Address = "Studentų g. 50, Kaunas, 301 kab.", Description = "Mokomasis tinklas ir darbo vietos", Owner = owner };
        var library = new Location { Name = "Bibliotekos skaitykla", Address = "K. Donelaičio g. 20, Kaunas", Description = "Lankytojų belaidžio tinklo zona", Owner = other };
        var router = new NetworkDevice { Name = "Laboratorijos maršrutizatorius", Location = lab, Type = "Router", IpAddress = "192.168.10.1", MacAddress = "02:00:00:10:00:01" };
        var networkSwitch = new NetworkDevice { Name = "Darbo vietų komutatorius", Location = lab, Type = "Switch", IpAddress = "192.168.10.2", MacAddress = "02:00:00:10:00:02" };
        var ap = new NetworkDevice { Name = "Skaityklos prieigos taškas", Location = library, Type = "AccessPoint", IpAddress = "192.168.20.1", MacAddress = "02:00:00:20:00:01" };
        db.Users.AddRange(admin, owner, other);
        db.Devices.AddRange(router, networkSwitch, ap);
        db.Clients.AddRange(
            new NetworkClient { Name = "Dėstytojo kompiuteris", Device = router, Type = "Computer", IpAddress = "192.168.10.10", MacAddress = "02:00:00:10:01:01" },
            new NetworkClient { Name = "Studento darbo vieta 01", Device = networkSwitch, Type = "Computer", IpAddress = "192.168.10.11", MacAddress = "02:00:00:10:01:02" },
            new NetworkClient { Name = "Laboratorijos spausdintuvas", Device = networkSwitch, Type = "Printer", IpAddress = "192.168.10.50", MacAddress = "02:00:00:10:01:03" },
            new NetworkClient { Name = "Skaitytojo planšetė", Device = ap, Type = "Tablet", IpAddress = "192.168.20.10", MacAddress = "02:00:00:20:01:01" });
        await db.SaveChangesAsync();
    }
}
