using System.ComponentModel.DataAnnotations;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Contracts;
using NetScope.Server.Data;
using NetScope.Server.Models;

namespace NetScope.Server.Controllers;

[Route("api/locations/{locationId:guid}/devices/{deviceId:guid}/clients")]
public class ClientsController(NetScopeDbContext db) : ApiControllerBase(db)
{
    [HttpGet]
    [EndpointSummary("Savo vietos įrenginio klientų sąrašas su paieška ir tipo filtru")]
    [ProducesResponseType<PageResult<ClientResponse>>(200)]
    public async Task<IActionResult> List(Guid locationId, Guid deviceId, [FromQuery] ListQuery filter,
        [FromQuery, RegularExpression("^(Computer|Phone|Tablet|Printer|Other)$")] string? type)
    {
        var device = await FindDevice(locationId, deviceId);
        if (device is null) return NotFound();
        if (!CanManage(device.Location)) return Forbid();
        var query = Db.Clients.AsNoTracking().Where(x => x.DeviceId == deviceId);
        if (!string.IsNullOrWhiteSpace(filter.Search)) query = query.Where(x => x.Name.ToLower().Contains(filter.Search.ToLower()) || x.IpAddress.Contains(filter.Search));
        if (type is not null) query = query.Where(x => x.Type == type);
        return Ok(await Page(query.OrderBy(x => x.Name).ThenBy(x => x.Id), filter, View));
    }

    [HttpGet("{clientId:guid}")]
    [EndpointSummary("Savo vietos įrenginio kliento informacija")]
    [ProducesResponseType<ClientResponse>(200)]
    public async Task<IActionResult> Get(Guid locationId, Guid deviceId, Guid clientId)
    {
        var device = await FindDevice(locationId, deviceId);
        if (device is null) return NotFound();
        if (!CanManage(device.Location)) return Forbid();
        var client = await Db.Clients.SingleOrDefaultAsync(x => x.Id == clientId && x.DeviceId == deviceId);
        return client is null ? NotFound() : Ok(View(client));
    }

    [HttpPost]
    [EndpointSummary("Sukurti klientą savo vietos įrenginyje")]
    [ProducesResponseType<ClientResponse>(201)]
    public async Task<IActionResult> Create(Guid locationId, Guid deviceId, ClientRequest request)
    {
        var device = await FindDevice(locationId, deviceId);
        if (device is null) return NotFound();
        if (!CanManage(device.Location)) return Forbid();
        var client = new NetworkClient { DeviceId = deviceId };
        Assign(client, request);
        Db.Clients.Add(client);
        await Db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { locationId, deviceId, clientId = client.Id }, View(client));
    }

    [HttpPut("{clientId:guid}")]
    [EndpointSummary("Atnaujinti klientą savo vietos įrenginyje")]
    [ProducesResponseType<ClientResponse>(200)]
    public async Task<IActionResult> Update(Guid locationId, Guid deviceId, Guid clientId, ClientRequest request)
    {
        var device = await FindDevice(locationId, deviceId);
        if (device is null) return NotFound();
        if (!CanManage(device.Location)) return Forbid();
        var client = await Db.Clients.SingleOrDefaultAsync(x => x.Id == clientId && x.DeviceId == deviceId);
        if (client is null) return NotFound();
        Assign(client, request);
        await Db.SaveChangesAsync();
        return Ok(View(client));
    }

    [HttpDelete("{clientId:guid}")]
    [EndpointSummary("Pašalinti savo vietos įrenginio klientą")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Delete(Guid locationId, Guid deviceId, Guid clientId)
    {
        var device = await FindDevice(locationId, deviceId);
        if (device is null) return NotFound();
        if (!CanManage(device.Location)) return Forbid();
        var client = await Db.Clients.SingleOrDefaultAsync(x => x.Id == clientId && x.DeviceId == deviceId);
        if (client is null) return NotFound();
        Db.Clients.Remove(client);
        await Db.SaveChangesAsync();
        return NoContent();
    }

    private static void Assign(NetworkClient entity, ClientRequest request)
    {
        entity.Name = request.Name.Trim(); entity.Type = request.Type; entity.IpAddress = request.IpAddress;
        entity.MacAddress = request.MacAddress.ToUpperInvariant();
    }
}
