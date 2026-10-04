using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Contracts;
using NetScope.Server.Data;

namespace NetScope.Server.Controllers;

[Route("api/overview")]
public class OverviewController(NetScopeDbContext db) : ApiControllerBase(db)
{
    [HttpGet]
    [EndpointSummary("Tinklo apžvalga iš vietų ir įrenginių duomenų")]
    [ProducesResponseType<OverviewResponse>(200)]
    public async Task<IActionResult> Get()
    {
        var locationCount = await Db.Locations.CountAsync();
        var deviceCount = await Db.Devices.CountAsync();
        var onlineDeviceCount = await Db.Devices.CountAsync(x => x.Status == "Online");
        var locations = await Db.Locations.AsNoTracking().OrderByDescending(x => x.CreatedAt)
            .ThenBy(x => x.Id).Take(5).ToListAsync();
        var ids = locations.Select(x => x.Id).ToArray();
        var counts = await Db.Devices.Where(x => ids.Contains(x.LocationId))
            .GroupBy(x => x.LocationId).Select(x => new { LocationId = x.Key, Count = x.Count() })
            .ToDictionaryAsync(x => x.LocationId, x => x.Count);
        var recent = locations.Select(x => new OverviewLocation(View(x), counts.GetValueOrDefault(x.Id))).ToList();

        return Ok(new OverviewResponse(locationCount, deviceCount, onlineDeviceCount, recent,
            new Dictionary<string, ResourceLink>
            {
                ["self"] = new("/api/overview", "GET"),
                ["locations"] = new("/api/locations", "GET")
            }));
    }
}
