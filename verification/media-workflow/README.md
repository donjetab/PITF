# Media workflow verification

Run `dotnet run --project verification/media-workflow/MediaWorkflow.csproj`. These checks use an isolated in-memory database and temporary image files; they never connect to the configured SQL Server. They cover first-save assignment for editions, days and plays, standalone news years, folder creation and preservation, reuse, upload context, repeated uploads and optimized variants.
