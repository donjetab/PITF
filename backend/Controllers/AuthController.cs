using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PITF.Api.Models;
using PITF.Api.Services;

namespace PITF.Api.Controllers;

[ApiController, Route("api/auth")]
public sealed class AuthController(UserManager<ApplicationUser> users, JwtTokenService tokens) : ControllerBase
{
    private static readonly string[] AllowedRoles = ["SuperAdmin", "Admin", "Editor"];

    [AllowAnonymous, HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await users.FindByEmailAsync(request.Email);
        if (user is null || !await users.CheckPasswordAsync(user, request.Password)) return Unauthorized(new { message = "Invalid email or password." });
        return Ok(new { token = await tokens.CreateAsync(user), user = await UserDto(user) });
    }

    [Authorize, HttpGet("me")]
    public async Task<IActionResult> Me()
    {
        var id = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        return Guid.TryParse(id, out var parsed) && await users.FindByIdAsync(parsed.ToString()) is { } user ? Ok(await UserDto(user)) : Unauthorized();
    }

    [Authorize(Policy = "SuperAdminOnly"), HttpGet("users")]
    public async Task<IActionResult> ListUsers()
    {
        var result = new List<object>();
        foreach (var user in await users.Users.OrderBy(x => x.Email).ToListAsync()) result.Add(await UserDto(user));
        return Ok(result);
    }

    [Authorize(Policy = "SuperAdminOnly"), HttpPost("users")]
    public async Task<IActionResult> Create(CreateUserRequest request)
    {
        if (!AllowedRoles.Contains(request.Role)) return BadRequest(new { message = "Invalid role." });
        var user = new ApplicationUser { UserName = request.Email.Trim(), Email = request.Email.Trim(), DisplayName = request.DisplayName?.Trim() };
        var result = await users.CreateAsync(user, request.Password);
        if (!result.Succeeded) return BadRequest(new { message = string.Join(" ", result.Errors.Select(x => x.Description)) });
        await users.AddToRoleAsync(user, request.Role);
        return Created($"/api/auth/users/{user.Id}", await UserDto(user));
    }

    [Authorize(Policy = "SuperAdminOnly"), HttpPut("users/{id:guid}")]
    public async Task<IActionResult> Update(Guid id, UpdateUserRequest request)
    {
        var user = await users.FindByIdAsync(id.ToString()); if (user is null) return NotFound();
        if (!AllowedRoles.Contains(request.Role)) return BadRequest(new { message = "Invalid role." });
        var currentId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (currentId == id.ToString() && request.Role != "SuperAdmin") return Conflict(new { message = "You cannot remove your own SuperAdmin role." });
        if (await users.IsInRoleAsync(user, "SuperAdmin") && request.Role != "SuperAdmin" && await CountSuperAdmins() <= 1)
            return Conflict(new { message = "At least one SuperAdmin account must remain." });
        user.Email = request.Email.Trim(); user.UserName = request.Email.Trim(); user.DisplayName = request.DisplayName?.Trim();
        var update = await users.UpdateAsync(user); if (!update.Succeeded) return BadRequest(new { message = string.Join(" ", update.Errors.Select(x => x.Description)) });
        var current = await users.GetRolesAsync(user); await users.RemoveFromRolesAsync(user, current); await users.AddToRoleAsync(user, request.Role);
        return Ok(await UserDto(user));
    }

    [Authorize(Policy = "SuperAdminOnly"), HttpPost("users/{id:guid}/reset-password")]
    public async Task<IActionResult> ResetPassword(Guid id, ResetPasswordRequest request)
    {
        var user = await users.FindByIdAsync(id.ToString()); if (user is null) return NotFound();
        var token = await users.GeneratePasswordResetTokenAsync(user); var result = await users.ResetPasswordAsync(user, token, request.Password);
        return result.Succeeded ? NoContent() : BadRequest(new { message = string.Join(" ", result.Errors.Select(x => x.Description)) });
    }

    [Authorize(Policy = "SuperAdminOnly"), HttpDelete("users/{id:guid}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        var currentId = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (currentId == id.ToString()) return Conflict(new { message = "You cannot delete your own active account." });
        var user = await users.FindByIdAsync(id.ToString()); if (user is null) return NotFound();
        if (await users.IsInRoleAsync(user, "SuperAdmin") && await CountSuperAdmins() <= 1)
            return Conflict(new { message = "At least one SuperAdmin account must remain." });
        var result = await users.DeleteAsync(user); return result.Succeeded ? NoContent() : BadRequest(new { message = string.Join(" ", result.Errors.Select(x => x.Description)) });
    }

    private async Task<object> UserDto(ApplicationUser user) => new { user.Id, user.Email, user.DisplayName, roles = await users.GetRolesAsync(user) };
    private async Task<int> CountSuperAdmins() => (await users.GetUsersInRoleAsync("SuperAdmin")).Count;
    public sealed record LoginRequest(string Email, string Password);
    public sealed record CreateUserRequest(string Email, string Password, string Role, string? DisplayName);
    public sealed record UpdateUserRequest(string Email, string Role, string? DisplayName);
    public sealed record ResetPasswordRequest(string Password);
}
