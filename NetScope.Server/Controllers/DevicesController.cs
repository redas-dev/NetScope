using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Contracts;
using NetScope.Server.Data;
using NetScope.Server.Models;

namespace NetScope.Server.Controllers;

[Route("api/locations/{locationId:guid}/devices")]
public class DevicesController(NetScopeDbContext db) : ApiControllerBase(db)
{
    [HttpGet]
    [EndpointSummary("Vietos įrenginių sąrašas su paieška, tipo ir būsenos filtrais")]
    [ProducesResponseType<PageResult<DeviceResponse>>(200)]
    public async Task<IActionResult> List(Guid locationId, [FromQuery] ListQuery filter,
        [FromQuery, RegularExpression("^(Router|Switch|AccessPoint|Firewall|Other)$")] string? type,
        [FromQuery, RegularExpression("^(Online|Offline|Maintenance)$")] string? status)
    {
        if (await FindLocation(locationId) is null) return NotFound();
        var query = Db.Devices.AsNoTracking().Where(x => x.LocationId == locationId);
        if (!string.IsNullOrWhiteSpace(filter.Search)) query = query.Where(x => x.Name.ToLower().Contains(filter.Search.ToLower()) || x.IpAddress.Contains(filter.Search));
        if (type is not null) query = query.Where(x => x.Type == type);
        if (status is not null) query = query.Where(x => x.Status == status);
        return Ok(await Page(query.OrderBy(x => x.Name).ThenBy(x => x.Id), filter, View));
    }

    [HttpGet("{deviceId:guid}")]
    [EndpointSummary("Konkretaus vietos įrenginio informacija")]
    [ProducesResponseType<DeviceResponse>(200)]
    public async Task<IActionResult> Get(Guid locationId, Guid deviceId)
    {
        var device = await FindDevice(locationId, deviceId);
        return device is null ? NotFound() : Ok(View(device));
    }

    [HttpPost]
    [EndpointSummary("Sukurti tinklo įrenginį savo vietoje")]
    [ProducesResponseType<DeviceResponse>(201)]
    public async Task<IActionResult> Create(Guid locationId, DeviceRequest request)
    {
        var location = await FindLocation(locationId);
        if (location is null) return NotFound();
        if (!CanManage(location)) return Forbid();
        var device = new NetworkDevice { LocationId = locationId };
        Assign(device, request);
        Db.Devices.Add(device);
        await Db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { locationId, deviceId = device.Id }, View(device));
    }

    [HttpPut("{deviceId:guid}")]
    [EndpointSummary("Atnaujinti savo vietos tinklo įrenginį")]
    [ProducesResponseType<DeviceResponse>(200)]
    public async Task<IActionResult> Update(Guid locationId, Guid deviceId, DeviceRequest request)
    {
        var device = await FindDevice(locationId, deviceId);
        if (device is null) return NotFound();
        if (!CanManage(device.Location)) return Forbid();
        Assign(device, request);
        await Db.SaveChangesAsync();
        return Ok(View(device));
    }

    [HttpDelete("{deviceId:guid}")]
    [EndpointSummary("Pašalinti savo vietos įrenginį kartu su jo klientais")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Delete(Guid locationId, Guid deviceId)
    {
        var device = await FindDevice(locationId, deviceId);
        if (device is null) return NotFound();
        if (!CanManage(device.Location)) return Forbid();
        Db.Devices.Remove(device);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    private static void Assign(NetworkDevice entity, DeviceRequest request)
    {
        entity.Name = request.Name.Trim(); entity.Type = request.Type; entity.IpAddress = request.IpAddress;
        entity.MacAddress = request.MacAddress.ToUpperInvariant(); entity.Status = request.Status;
    }
}
