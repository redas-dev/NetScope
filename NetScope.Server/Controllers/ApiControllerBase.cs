using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Contracts;
using NetScope.Server.Data;
using NetScope.Server.Models;

namespace NetScope.Server.Controllers;

[ApiController]
[Authorize]
[Produces("application/json")]
[ProducesResponseType<ProblemDetails>(400)]
[ProducesResponseType<ProblemDetails>(401)]
[ProducesResponseType<ProblemDetails>(403)]
[ProducesResponseType<ProblemDetails>(404)]
[ProducesResponseType<ProblemDetails>(409)]
public abstract class ApiControllerBase(NetScopeDbContext db) : ControllerBase
{
    protected NetScopeDbContext Db => db;
    protected Guid CurrentUserId => Guid.Parse(User.FindFirstValue("sub")!);
    protected bool IsAdmin => User.IsInRole("Admin");
    protected bool CanManage(Location location) => IsAdmin || location.OwnerId == CurrentUserId;
    protected Task<Location?> FindLocation(Guid locationId) => db.Locations.SingleOrDefaultAsync(x => x.Id == locationId);
    protected Task<NetworkDevice?> FindDevice(Guid locationId, Guid deviceId) => db.Devices.Include(x => x.Location)
        .SingleOrDefaultAsync(x => x.Id == deviceId && x.LocationId == locationId);
    protected static LocationResponse View(Location x) => new(x.Id, x.Name, x.Address, x.Description, x.OwnerId, x.CreatedAt,
        new Dictionary<string, ResourceLink>
        {
            ["self"] = new($"/api/locations/{x.Id}", "GET"),
            ["collection"] = new("/api/locations", "GET"),
            ["devices"] = new($"/api/locations/{x.Id}/devices", "GET")
        });
    protected static DeviceResponse View(NetworkDevice x) => new(x.Id, x.LocationId, x.Name, x.Type, x.IpAddress, x.MacAddress, x.Status,
        new Dictionary<string, ResourceLink>
        {
            ["self"] = new($"/api/locations/{x.LocationId}/devices/{x.Id}", "GET"),
            ["location"] = new($"/api/locations/{x.LocationId}", "GET"),
            ["collection"] = new($"/api/locations/{x.LocationId}/devices", "GET"),
            ["clients"] = new($"/api/locations/{x.LocationId}/devices/{x.Id}/clients", "GET")
        });
    protected static ClientResponse View(NetworkClient x, Guid locationId) => new(x.Id, x.DeviceId, x.Name, x.Type, x.IpAddress, x.MacAddress,
        new Dictionary<string, ResourceLink>
        {
            ["self"] = new($"/api/locations/{locationId}/devices/{x.DeviceId}/clients/{x.Id}", "GET"),
            ["device"] = new($"/api/locations/{locationId}/devices/{x.DeviceId}", "GET"),
            ["collection"] = new($"/api/locations/{locationId}/devices/{x.DeviceId}/clients", "GET")
        });
    protected async Task<PageResult<TOut>> Page<T, TOut>(IQueryable<T> query, ListQuery filter, Func<T, TOut> map)
    {
        var count = await query.CountAsync();
        var items = await query.Skip((filter.Page - 1) * filter.PageSize).Take(filter.PageSize).ToListAsync();
        string PageHref(int page)
        {
            var parts = Request.Query.Where(x => x.Key is not "page" and not "pageSize")
                .SelectMany(x => x.Value.Select(value => $"{Uri.EscapeDataString(x.Key)}={Uri.EscapeDataString(value ?? "")}"))
                .Append($"page={page}").Append($"pageSize={filter.PageSize}");

            return $"{Request.Path}?{string.Join("&", parts)}";
        }
        var links = new Dictionary<string, ResourceLink> { ["self"] = new(PageHref(filter.Page), "GET") };
        if (filter.Page > 1) links["previous"] = new(PageHref(filter.Page - 1), "GET");
        if ((long)filter.Page * filter.PageSize < count) links["next"] = new(PageHref(filter.Page + 1), "GET");

        return new(items.Select(map).ToList(), count, filter.Page, filter.PageSize, links);
    }
}
