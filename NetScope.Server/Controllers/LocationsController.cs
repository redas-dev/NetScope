using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Contracts;
using NetScope.Server.Data;
using NetScope.Server.Models;

namespace NetScope.Server.Controllers;

[Route("api/locations")]
public class LocationsController(NetScopeDbContext db) : ApiControllerBase(db)
{
    [HttpGet]
    [EndpointSummary("Vietų sąrašas su paieška, savininko filtru ir puslapiavimu")]
    [ProducesResponseType<PageResult<LocationResponse>>(200)]
    public async Task<IActionResult> List([FromQuery] ListQuery filter, [FromQuery] Guid? ownerId)
    {
        var query = Db.Locations.AsNoTracking();
        if (ownerId.HasValue) query = query.Where(x => x.OwnerId == ownerId);
        if (!string.IsNullOrWhiteSpace(filter.Search)) query = query.Where(x => x.Name.ToLower().Contains(filter.Search.ToLower()) || x.Address.ToLower().Contains(filter.Search.ToLower()));
        return Ok(await Page(query.OrderBy(x => x.Name).ThenBy(x => x.Id), filter, View));
    }

    [HttpGet("{locationId:guid}")]
    [EndpointSummary("Konkrečios vietos informacija")]
    [ProducesResponseType<LocationResponse>(200)]
    public async Task<IActionResult> Get(Guid locationId)
    {
        var location = await FindLocation(locationId);
        return location is null ? NotFound() : Ok(View(location));
    }

    [HttpPost]
    [EndpointSummary("Sukurti vietą dabartiniam naudotojui")]
    [ProducesResponseType<LocationResponse>(201)]
    public async Task<IActionResult> Create(LocationRequest request)
    {
        var location = new Location { Name = request.Name.Trim(), Address = request.Address.Trim(), Description = request.Description?.Trim(), OwnerId = CurrentUserId };
        Db.Locations.Add(location);
        await Db.SaveChangesAsync();
        return CreatedAtAction(nameof(Get), new { locationId = location.Id }, View(location));
    }

    [HttpPut("{locationId:guid}")]
    [EndpointSummary("Atnaujinti savo vietą; administratorius gali atnaujinti visas")]
    [ProducesResponseType<LocationResponse>(200)]
    public async Task<IActionResult> Update(Guid locationId, LocationRequest request)
    {
        var location = await FindLocation(locationId);
        if (location is null) return NotFound();
        if (!CanManage(location)) return Forbid();
        location.Name = request.Name.Trim(); location.Address = request.Address.Trim(); location.Description = request.Description?.Trim();
        await Db.SaveChangesAsync();
        return Ok(View(location));
    }

    [HttpDelete("{locationId:guid}")]
    [EndpointSummary("Pašalinti vietą kartu su įrenginiais ir klientais")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Delete(Guid locationId)
    {
        var location = await FindLocation(locationId);
        if (location is null) return NotFound();
        if (!CanManage(location)) return Forbid();
        Db.Locations.Remove(location);
        await Db.SaveChangesAsync();
        return NoContent();
    }
}
