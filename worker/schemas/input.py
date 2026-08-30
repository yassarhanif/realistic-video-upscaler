from typing import Dict, Any

def validate_input(job_input: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validates and normalizes input arguments for the ByteDance SeedVR2 worker.
    """
    if not isinstance(job_input, dict):
        raise ValueError("Job input must be a JSON object.")

    video_url = job_input.get("video_url")
    file_key = job_input.get("file_key")

    if not video_url and not file_key:
        raise ValueError("Either 'video_url' or 'file_key' must be provided.")

    scale = job_input.get("scale", 4)
    try:
        scale = int(scale)
        if scale not in [2, 4]:
            scale = 4
    except (ValueError, TypeError):
        scale = 4

    outscale = job_input.get("outscale", scale)
    try:
        outscale = float(outscale)
    except (ValueError, TypeError):
        outscale = scale

    denoise_strength = job_input.get("denoise_strength", 0.5)
    try:
        denoise_strength = float(denoise_strength)
        denoise_strength = max(0.0, min(1.0, denoise_strength))
    except (ValueError, TypeError):
        denoise_strength = 0.5

    return {
        "video_url": video_url,
        "file_key": file_key,
        "scale": scale,
        "outscale": outscale,
        "model_name": "SeedVR2",
        "denoise_strength": denoise_strength,
    }
