using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Models;

namespace NetScope.Server.Data;

public static class DemoSeeder
{
    public static async Task SeedAsync(NetScopeDbContext db)
    {
        User? owner;
        User? other;
        if (!await db.Users.AnyAsync())
        {
            var hasher = new PasswordHasher<User>();
            var admin = new User { Email = "admin@netscope.local", Role = "Admin" };
            owner = new User { Email = "redas@netscope.local" };
            other = new User { Email = "ieva@netscope.local" };
            foreach (var user in new[] { admin, owner, other })
                user.PasswordHash = hasher.HashPassword(user, "NetScopeDemo!2026");
            db.Users.AddRange(admin, owner, other);
            await db.SaveChangesAsync();
        }
        else
        {
            owner = await db.Users.SingleOrDefaultAsync(x => x.Email == "redas@netscope.local");
            other = await db.Users.SingleOrDefaultAsync(x => x.Email == "ieva@netscope.local");
            if (owner is null || other is null) return;
        }

        var locationData = new (string Name, string Address, string Description, User Owner)[]
        {
            ("KTU tinklų laboratorija", "Studentų g. 50, Kaunas, 301 kab.", "Mokomasis tinklas ir darbo vietos", owner),
            ("Bibliotekos skaitykla", "K. Donelaičio g. 20, Kaunas", "Lankytojų belaidžio tinklo zona", other),
            ("KTU serverių patalpa", "Studentų g. 48, Kaunas, 102 kab.", "Vidinių paslaugų ir ugniasienės infrastruktūra", owner),
            ("Elektronikos praktikumų klasė", "Studentų g. 50, Kaunas, 214 kab.", "Studentų praktinių užsiėmimų tinklas", owner),
            ("Bibliotekos konferencijų salė", "K. Donelaičio g. 20, Kaunas, 2 aukštas", "Renginių belaidžio tinklo zona", other)
        };
        var locations = await db.Locations.ToListAsync();
        var demoLocations = new Dictionary<string, Location>();
        foreach (var item in locationData)
        {
            var location = locations.FirstOrDefault(x => x.OwnerId == item.Owner.Id && x.Name == item.Name);
            if (location is null)
            {
                location = new Location { Name = item.Name, Address = item.Address, Description = item.Description, OwnerId = item.Owner.Id };
                db.Locations.Add(location);
                locations.Add(location);
            }
            demoLocations[item.Name] = location;
        }
        await db.SaveChangesAsync();

        var deviceData = new (string Location, string Name, string Type, string Ip, string Mac)[]
        {
            ("KTU tinklų laboratorija", "Laboratorijos maršrutizatorius", "Router", "192.168.10.1", "02:00:00:10:00:01"),
            ("KTU tinklų laboratorija", "Darbo vietų komutatorius", "Switch", "192.168.10.2", "02:00:00:10:00:02"),
            ("Bibliotekos skaitykla", "Skaityklos prieigos taškas", "AccessPoint", "192.168.20.1", "02:00:00:20:00:01"),
            ("KTU serverių patalpa", "Serverių tinklo ugniasienė", "Firewall", "192.168.30.1", "02:00:00:30:00:01"),
            ("Bibliotekos konferencijų salė", "Konferencijų salės prieigos taškas", "AccessPoint", "192.168.40.1", "02:00:00:40:00:01")
        };
        var devices = await db.Devices.ToListAsync();
        var demoDevices = new Dictionary<string, NetworkDevice>();
        foreach (var item in deviceData)
        {
            var location = demoLocations[item.Location];
            var device = devices.FirstOrDefault(x => x.LocationId == location.Id && x.MacAddress == item.Mac);
            if (device is null)
            {
                device = new NetworkDevice { LocationId = location.Id, Name = item.Name, Type = item.Type,
                    IpAddress = item.Ip, MacAddress = item.Mac };
                db.Devices.Add(device);
                devices.Add(device);
            }
            demoDevices[item.Name] = device;
        }
        await db.SaveChangesAsync();

        var clientData = new (string Device, string Name, string Type, string Ip, string Mac)[]
        {
            ("Laboratorijos maršrutizatorius", "Dėstytojo kompiuteris", "Computer", "192.168.10.10", "02:00:00:10:01:01"),
            ("Darbo vietų komutatorius", "Studento darbo vieta 01", "Computer", "192.168.10.11", "02:00:00:10:01:02"),
            ("Darbo vietų komutatorius", "Laboratorijos spausdintuvas", "Printer", "192.168.10.50", "02:00:00:10:01:03"),
            ("Skaityklos prieigos taškas", "Skaitytojo planšetė", "Tablet", "192.168.20.10", "02:00:00:20:01:01"),
            ("Serverių tinklo ugniasienė", "Virtualizacijos serveris", "Computer", "192.168.30.10", "02:00:00:30:01:01")
        };
        var clients = await db.Clients.ToListAsync();
        foreach (var item in clientData)
        {
            var device = demoDevices[item.Device];
            if (clients.Any(x => x.DeviceId == device.Id && x.MacAddress == item.Mac)) continue;
            db.Clients.Add(new NetworkClient { DeviceId = device.Id, Name = item.Name, Type = item.Type,
                IpAddress = item.Ip, MacAddress = item.Mac });
        }
        await db.SaveChangesAsync();
    }
}
