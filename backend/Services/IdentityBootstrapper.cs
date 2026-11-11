using Microsoft.AspNetCore.Identity;
using PITF.Api.Models;

namespace PITF.Api.Services;

public sealed class IdentityBootstrapper(RoleManager<IdentityRole<Guid>> roles, UserManager<ApplicationUser> users)
{
    public async Task<ApplicationUser> EnsureSuperAdminAsync(string email, string password, bool resetPassword = false)
    {
        foreach (var role in new[] { "SuperAdmin", "Admin", "Editor" })
            if (!await roles.RoleExistsAsync(role)) await roles.CreateAsync(new IdentityRole<Guid>(role));
        var user = await users.FindByEmailAsync(email);
        if (user is null)
        {
            user = new ApplicationUser { UserName = email, Email = email, DisplayName = "PITF Super Admin" };
            var created = await users.CreateAsync(user, password);
            if (!created.Succeeded) throw new InvalidOperationException(string.Join(" ", created.Errors.Select(x => x.Description)));
        }
        else if (resetPassword)
        {
            var token = await users.GeneratePasswordResetTokenAsync(user);
            var reset = await users.ResetPasswordAsync(user, token, password);
            if (!reset.Succeeded) throw new InvalidOperationException(string.Join(" ", reset.Errors.Select(x => x.Description)));
        }
        if (!await users.IsInRoleAsync(user, "SuperAdmin")) await users.AddToRoleAsync(user, "SuperAdmin");
        return user;
    }
}
