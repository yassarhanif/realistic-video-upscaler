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

    denoise_strength = job_input.get("denoise_strength", 0.25)
    try:
        denoise_strength = float(denoise_strength)
        denoise_strength = max(0.0, min(1.0, denoise_strength))
    except (ValueError, TypeError):
        denoise_strength = 0.25

    batch_size = job_input.get("batch_size", 9)
    try:
        batch_size = int(batch_size)
        if batch_size not in [1, 5, 9, 13, 17, 21]:
            batch_size = 9
    except (ValueError, TypeError):
        batch_size = 9

    uniform_batch_size = job_input.get("uniform_batch_size", True)
    try:
        uniform_batch_size = bool(uniform_batch_size)
    except (ValueError, TypeError):
        uniform_batch_size = True

    color_correction = job_input.get("color_correction", "lab")
    valid_color_methods = ["lab", "wavelet", "wavelet_adaptive", "hsv", "adain", "none"]
    if color_correction not in valid_color_methods:
        color_correction = "lab"

    input_noise_scale = job_input.get("input_noise_scale", 0.0)
    try:
        input_noise_scale = float(input_noise_scale)
        input_noise_scale = max(0.0, min(1.0, input_noise_scale))
    except (ValueError, TypeError):
        input_noise_scale = 0.0

    latent_noise_scale = job_input.get("latent_noise_scale", 0.0)
    try:
        latent_noise_scale = float(latent_noise_scale)
        latent_noise_scale = max(0.0, min(1.0, latent_noise_scale))
    except (ValueError, TypeError):
        latent_noise_scale = 0.0

    resolution = job_input.get("resolution", 1080)
    try:
        resolution = int(resolution)
        resolution = max(256, min(4096, resolution))
    except (ValueError, TypeError):
        resolution = 1080

    max_resolution = job_input.get("max_resolution", 0)
    try:
        max_resolution = int(max_resolution)
        max_resolution = max(0, max_resolution)
    except (ValueError, TypeError):
        max_resolution = 0

    attention_mode = job_input.get("attention_mode", "sdpa")
    valid_attention_modes = ["sdpa", "flash_attn_2", "flash_attn_3", "sageattn_2", "sageattn_3"]
    if attention_mode not in valid_attention_modes:
        attention_mode = "sdpa"

    return {
        "video_url": video_url,
        "file_key": file_key,
        "scale": scale,
        "outscale": outscale,
        "model_name": "SeedVR2",
        "denoise_strength": denoise_strength,
        "batch_size": batch_size,
        "uniform_batch_size": uniform_batch_size,
        "color_correction": color_correction,
        "input_noise_scale": input_noise_scale,
        "latent_noise_scale": latent_noise_scale,
        "resolution": resolution,
        "max_resolution": max_resolution,
        "attention_mode": attention_mode,
    }
