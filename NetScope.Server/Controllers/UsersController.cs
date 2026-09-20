using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using NetScope.Server.Contracts;
using NetScope.Server.Data;

namespace NetScope.Server.Controllers;

[Authorize(Roles = "Admin")]
[Route("api/users")]
public class UsersController(NetScopeDbContext db) : ApiControllerBase(db)
{
    [HttpGet]
    [EndpointSummary("Administratoriui: naudotojų sąrašas")]
    [ProducesResponseType<PageResult<UserResponse>>(200)]
    public async Task<IActionResult> List([FromQuery] ListQuery filter)
    {
        var query = Db.Users.AsNoTracking();
        if (!string.IsNullOrWhiteSpace(filter.Search)) query = query.Where(x => x.Email.Contains(filter.Search.ToLower()));
        return Ok(await Page(query.OrderBy(x => x.Email), filter, x => new UserResponse(x.Id, x.Email, x.Role)));
    }

    [HttpDelete("{userId:guid}")]
    [EndpointSummary("Administratoriui: pašalinti naudotoją ir jam priklausančius duomenis")]
    [ProducesResponseType(204)]
    public async Task<IActionResult> Delete(Guid userId)
    {
        if (userId == CurrentUserId) return Problem(statusCode: 409, title: "Negalima pašalinti savo administratoriaus paskyros.");
        var user = await Db.Users.FindAsync(userId);
        if (user is null) return NotFound();
        Db.Users.Remove(user);
        await Db.SaveChangesAsync();
        return NoContent();
    }
}
