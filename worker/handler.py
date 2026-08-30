import os
import sys
import time
import uuid
import shutil
import subprocess
import requests
import torch
import numpy as np
from PIL import Image
import boto3
from botocore.config import Config
import runpod

from schemas.input import validate_input

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODELS_DIR = os.getenv("MODELS_DIR", "/models/SEEDVR2")
SEEDVR_CLI = "/app/seedvr2/inference_cli.py" if os.path.exists("/app/seedvr2/inference_cli.py") else "inference_cli.py"
FFMPEG_BIN = "/usr/bin/ffmpeg" if os.path.exists("/usr/bin/ffmpeg") else "ffmpeg"
FFPROBE_BIN = "/usr/bin/ffprobe" if os.path.exists("/usr/bin/ffprobe") else "ffprobe"


def get_r2_client():
    account_id = os.getenv("R2_ACCOUNT_ID", "")
    access_key = os.getenv("R2_ACCESS_KEY_ID", "")
    secret_key = os.getenv("R2_SECRET_ACCESS_KEY", "")

    if not (account_id and access_key and secret_key):
        return None

    return boto3.client(
        "s3",
        endpoint_url=f"https://{account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        config=Config(signature_version="s3v4"),
        region_name="auto",
    )


def download_file(video_url, file_key, target_path):
    r2_client = get_r2_client()
    bucket_name = os.getenv("R2_BUCKET_NAME", "upscale")

    if file_key and r2_client:
        try:
            print(f"Downloading {file_key} from R2 bucket {bucket_name}...")
            r2_client.download_file(bucket_name, file_key, target_path)
            return
        except Exception as e:
            print(f"Direct R2 download failed, trying video_url: {e}")

    if video_url:
        print(f"Downloading from URL: {video_url}...")
        resp = requests.get(video_url, stream=True, timeout=120)
        resp.raise_for_status()
        with open(target_path, "wb") as f:
            for chunk in resp.iter_content(chunk_size=8192):
                f.write(chunk)
    else:
        raise ValueError("Could not download input file: No valid URL or R2 credentials found.")


def upload_to_r2(local_path, output_key, content_type="video/mp4"):
    r2_client = get_r2_client()
    bucket_name = os.getenv("R2_BUCKET_NAME", "upscale")
    public_domain = os.getenv("R2_PUBLIC_DOMAIN", "").rstrip("/")

    if r2_client:
        print(f"Uploading {local_path} to R2 bucket '{bucket_name}' key '{output_key}'...")
        with open(local_path, "rb") as f:
            r2_client.upload_fileobj(
                f,
                bucket_name,
                output_key,
                ExtraArgs={"ContentType": content_type},
            )

        if public_domain:
            return f"{public_domain}/{output_key}"
        return output_key

    print("WARNING: R2 credentials not configured. Returning local path.")
    return local_path


def probe_media(file_path):
    cmd = [
        FFPROBE_BIN,
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,nb_frames",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path,
    ]
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    lines = [line.strip() for line in result.stdout.strip().split("\n") if line.strip()]

    width = int(lines[0]) if len(lines) > 0 else 1280
    height = int(lines[1]) if len(lines) > 1 else 720

    fps = 30.0
    if len(lines) > 2:
        rate = lines[2]
        if "/" in rate:
            num, den = rate.split("/")
            fps = float(num) / float(den) if float(den) != 0 else 30.0
        else:
            fps = float(rate)

    nb_frames = 0
    if len(lines) > 3:
        try:
            nb_frames = int(lines[3])
        except ValueError:
            pass

    audio_cmd = [
        FFPROBE_BIN,
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1",
        file_path,
    ]
    audio_result = subprocess.run(audio_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    has_audio = bool(audio_result.stdout.strip())

    return {
        "width": width,
        "height": height,
        "fps": fps,
        "nb_frames": nb_frames,
        "has_audio": has_audio,
    }


def run_seedvr2_upscale(
    input_path,
    output_path,
    scale=4,
    is_image=False,
    denoise_strength=0.25,
    batch_size=9,
    uniform_batch_size=True,
    color_correction="lab",
    input_noise_scale=0.0,
    latent_noise_scale=0.0,
    resolution=1080,
    max_resolution=0,
    attention_mode="sdpa",
):
    """
    Executes official ByteDance SeedVR2-3B Diffusion Transformer inference.
    """
    meta = probe_media(input_path)
    in_w = meta["width"]
    in_h = meta["height"]
    short_edge = min(in_w, in_h)
    target_resolution = int(short_edge * scale)
    
    # Cap target resolution to standard bounds if necessary
    target_resolution = max(target_resolution, 720)

    if resolution != 1080:
        target_resolution = resolution

    print(f"[SeedVR2-3B] Input dimension: {in_w}x{in_h} -> Target short-side resolution: {target_resolution} (Scale: {scale}x)")
    print(f"[SeedVR2-3B] Quality params: denoise={denoise_strength}, batch_size={batch_size}, color_correction={color_correction}, attention={attention_mode}")

    # Find models directory
    model_dir = MODELS_DIR
    if not os.path.exists(model_dir):
        alt_dir = "/models"
        if os.path.exists(os.path.join(alt_dir, "seedvr2_ema_3b_fp8_e4m3fn.safetensors")):
            model_dir = alt_dir
        elif os.path.exists(os.path.join(alt_dir, "SEEDVR2")):
            model_dir = os.path.join(alt_dir, "SEEDVR2")

    # Command for official SeedVR2 CLI
    temp_seedvr_out = output_path
    if not is_image and meta["has_audio"]:
        temp_seedvr_out = output_path.replace(".mp4", "_raw_video.mp4")

    cmd = [
        sys.executable, SEEDVR_CLI,
        input_path,
        "--output", temp_seedvr_out,
        "--model_dir", model_dir,
        "--dit_model", "seedvr2_ema_3b_fp8_e4m3fn.safetensors",
        "--resolution", str(target_resolution),
        "--batch_size", str(batch_size),
        "--color_correction", color_correction,
        "--attention_mode", attention_mode,
        "--vae_encode_tiled",
        "--vae_decode_tiled",
        "--dit_offload_device", "cpu",
        "--vae_offload_device", "cpu",
    ]

    if uniform_batch_size:
        cmd.append("--uniform_batch_size")

    if input_noise_scale > 0:
        cmd.extend(["--input_noise_scale", str(input_noise_scale)])
    if latent_noise_scale > 0:
        cmd.extend(["--latent_noise_scale", str(latent_noise_scale)])

    if max_resolution > 0:
        cmd.extend(["--max_resolution", str(max_resolution)])

    if not is_image:
        cmd.extend(["--video_backend", "ffmpeg"])

    print(f"[SeedVR2-3B] Executing CLI command: {' '.join(cmd)}")
    result = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)

    if result.returncode != 0:
        err_msg = (result.stderr or result.stdout or "").strip()
        print(f"[SeedVR2-3B] CLI stderr output:\n{err_msg}")
        raise RuntimeError(f"SeedVR2 CLI inference failed with return code {result.returncode}:\n{err_msg}")


    # If video had audio, mux the original audio back into the final output
    if not is_image and meta["has_audio"] and os.path.exists(temp_seedvr_out):
        print(f"[SeedVR2-3B] Muxing original audio into final MP4...")
        mux_cmd = [
            FFMPEG_BIN, "-y",
            "-i", temp_seedvr_out,
            "-i", input_path,
            "-map", "0:v:0",
            "-map", "1:a:0",
            "-c:v", "copy",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            output_path,
        ]
        mux_result = subprocess.run(mux_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        if mux_result.returncode == 0:
            if os.path.exists(temp_seedvr_out):
                os.remove(temp_seedvr_out)
        else:
            print(f"[SeedVR2-3B] Audio mux warning, using raw video: {mux_result.stderr}")
            shutil.move(temp_seedvr_out, output_path)

    return meta["nb_frames"] or 1


def handler(job):
    start_time = time.time()
    job_id = job.get("id", str(uuid.uuid4()))
    raw_input = job.get("input", {})

    print(f"--- [SeedVR2-3B Job {job_id}] Started ---")

    try:
        validated = validate_input(raw_input)
        video_url = validated["video_url"]
        file_key = validated["file_key"]
        scale = validated["scale"]
        outscale = validated["outscale"]

        quality_params = {
            "denoise_strength": validated["denoise_strength"],
            "batch_size": validated["batch_size"],
            "uniform_batch_size": validated["uniform_batch_size"],
            "color_correction": validated["color_correction"],
            "input_noise_scale": validated["input_noise_scale"],
            "latent_noise_scale": validated["latent_noise_scale"],
            "resolution": validated["resolution"],
            "max_resolution": validated["max_resolution"],
            "attention_mode": validated["attention_mode"],
        }

        work_dir = f"/tmp/{job_id}"
        os.makedirs(work_dir, exist_ok=True)

        input_filename = os.path.basename(file_key or video_url or "input.mp4")
        is_image = any(input_filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"])

        input_path = os.path.join(work_dir, f"input_{input_filename}")
        download_file(video_url, file_key, input_path)

        if is_image:
            output_path = os.path.join(work_dir, "output.png")
            frames = run_seedvr2_upscale(input_path, output_path, scale=scale, is_image=True, **quality_params)
            content_type = "image/png"
            output_key = f"output-images/{job_id}_upscaled.png"
        else:
            output_path = os.path.join(work_dir, "output.mp4")
            frames = run_seedvr2_upscale(input_path, output_path, scale=scale, is_image=False, **quality_params)
            content_type = "video/mp4"
            output_key = f"output-videos/{job_id}_upscaled.mp4"

        output_url = upload_to_r2(output_path, output_key, content_type=content_type)

        elapsed = time.time() - start_time
        print(f"--- [SeedVR2-3B Job {job_id}] Completed in {elapsed:.2f}s ({frames} frames) ---")

        shutil.rmtree(work_dir, ignore_errors=True)

        return {
            "output_url": output_url,
            "file_key": output_key,
            "frames_processed": frames,
            "process_time": round(elapsed, 2),
            "scale": scale,
            "model_name": "ByteDance SeedVR2-3B",
        }

    except Exception as e:
        print(f"--- [SeedVR2-3B Job {job_id}] ERROR: {str(e)} ---")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})

