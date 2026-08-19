using Microsoft.AspNetCore.Mvc;

namespace PITF.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public sealed class HealthController : ControllerBase
{
    [HttpGet]
    public IActionResult Get() => Ok(new { status = "healthy", service = "PITF API", timestamp = DateTimeOffset.UtcNow });
}
