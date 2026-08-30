import os
import sys
import time
import uuid
import shutil
import subprocess
import requests
import cv2
import torch
import numpy as np
import boto3
from botocore.config import Config
import runpod

from schemas.input import validate_input

# BasicSR & RealESRGAN
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer
from realesrgan.archs.srvgg_arch import SRVGGNetCompact

# GFPGAN Face Restoration
from gfpgan import GFPGANer

# Global cached models to avoid reloading per request
CACHED_MODELS = {}
CACHED_FACE_ENHANCER = None

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODELS_DIR = os.getenv("MODELS_DIR", "/models")


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


def get_upscaler(model_name="RealESRGAN_x4plus", scale=4, tile=0, denoise_strength=0.5):
    cache_key = f"{model_name}_{scale}_{tile}_{denoise_strength}"
    if cache_key in CACHED_MODELS:
        return CACHED_MODELS[cache_key]

    model_path = os.path.join(MODELS_DIR, f"{model_name}.pth")
    if not os.path.exists(model_path):
        model_path = os.path.join(os.path.dirname(__file__), "models", f"{model_name}.pth")

    if model_name == "RealESRGAN_x4plus":
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        netscale = 4
    elif model_name == "RealESRGAN_x2plus":
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=2)
        netscale = 2
    elif model_name == "realesr-general-x4v3":
        model = SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type="prelu")
        netscale = 4
    else:
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        netscale = 4

    upscaler = RealESRGANer(
        scale=netscale,
        model_path=model_path if os.path.exists(model_path) else None,
        model=model,
        tile=tile,
        tile_pad=10,
        pre_pad=0,
        half=True if torch.cuda.is_available() else False,
        device=DEVICE,
    )

    CACHED_MODELS[cache_key] = upscaler
    return upscaler


def get_face_enhancer(scale=4):
    global CACHED_FACE_ENHANCER
    if CACHED_FACE_ENHANCER is not None:
        return CACHED_FACE_ENHANCER

    model_path = os.path.join(MODELS_DIR, "GFPGANv1.3.pth")
    if not os.path.exists(model_path):
        model_path = os.path.join(os.path.dirname(__file__), "models", "GFPGANv1.3.pth")

    face_enhancer = GFPGANer(
        model_path=model_path if os.path.exists(model_path) else None,
        upscale=scale,
        arch="clean",
        channel_multiplier=2,
        bg_upsampler=None,
        device=DEVICE,
    )
    CACHED_FACE_ENHANCER = face_enhancer
    return face_enhancer


def download_file(video_url, file_key, target_path):
    r2_client = get_r2_client()
    bucket_name = os.getenv("R2_BUCKET_NAME", "video-upscaler")

    # If file_key is provided and R2 client configured, download directly from bucket
    if file_key and r2_client:
        try:
            print(f"Downloading {file_key} from bucket {bucket_name}...")
            r2_client.download_file(bucket_name, file_key, target_path)
            return
        except Exception as e:
            print(f"Direct R2 download failed, trying video_url: {e}")

    # Otherwise download via HTTP URL
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
    bucket_name = os.getenv("R2_BUCKET_NAME", "video-upscaler")
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


def probe_video(video_path):
    cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "v:0",
        "-show_entries", "stream=width,height,r_frame_rate,nb_frames,duration",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
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

    # Check if video has audio stream
    audio_cmd = [
        "ffprobe",
        "-v", "error",
        "-select_streams", "a:0",
        "-show_entries", "stream=codec_type",
        "-of", "default=noprint_wrappers=1:nokey=1",
        video_path,
    ]
    audio_result = subprocess.run(audio_cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    has_audio = bool(audio_result.stdout.strip())

    return {
        "width": width,
        "height": height,
        "fps": fps,
        "has_audio": has_audio,
    }


def process_image(input_path, output_path, upscaler, face_enhancer, outscale=4):
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Failed to decode input image.")

    output, _ = upscaler.enhance(img, outscale=outscale)

    if face_enhancer is not None:
        _, _, output = face_enhancer.enhance(
            output,
            has_aligned=False,
            only_center_face=False,
            paste_back=True,
        )

    cv2.imwrite(output_path, output)
    return 1


def process_video(input_path, output_path, upscaler, face_enhancer, outscale=4):
    meta = probe_video(input_path)
    in_w, in_h = meta["width"], meta["height"]
    fps = meta["fps"]
    has_audio = meta["has_audio"]

    out_w = int(in_w * outscale)
    out_h = int(in_h * outscale)

    # Ensure even dimensions for H.264
    out_w = out_w if out_w % 2 == 0 else out_w + 1
    out_h = out_h if out_h % 2 == 0 else out_h + 1

    temp_audio_path = "/tmp/extracted_audio.aac"
    if has_audio:
        print("Extracting audio stream...")
        subprocess.run(
            ["ffmpeg", "-y", "-i", input_path, "-vn", "-c:a", "copy", temp_audio_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )
        if not os.path.exists(temp_audio_path) or os.path.getsize(temp_audio_path) == 0:
            # Fallback to AAC encoding if direct copy fails
            subprocess.run(
                ["ffmpeg", "-y", "-i", input_path, "-vn", "-c:a", "aac", "-b:a", "192k", temp_audio_path],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
            )

    # Reader subprocess (raw video frames from input)
    reader_cmd = [
        "ffmpeg",
        "-i", input_path,
        "-f", "image2pipe",
        "-pix_fmt", "bgr24",
        "-vcodec", "rawvideo",
        "-",
    ]
    reader = subprocess.Popen(reader_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10**8)

    # Writer subprocess (encoded H.264 MP4 with muxed audio)
    writer_cmd = [
        "ffmpeg",
        "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{out_w}x{out_h}",
        "-pix_fmt", "bgr24",
        "-r", str(fps),
        "-i", "-",
    ]

    if has_audio and os.path.exists(temp_audio_path) and os.path.getsize(temp_audio_path) > 0:
        writer_cmd.extend(["-i", temp_audio_path, "-c:a", "aac", "-b:a", "192k", "-shortest"])

    writer_cmd.extend([
        "-c:v", "libx264",
        "-preset", "medium",
        "-crf", "18",
        "-pix_fmt", "yuv420p",
        output_path,
    ])

    writer = subprocess.Popen(writer_cmd, stdin=subprocess.PIPE, stderr=subprocess.DEVNULL, bufsize=10**8)

    frame_size = in_w * in_h * 3
    frames_processed = 0

    print(f"Upscaling video from {in_w}x{in_h} to {out_w}x{out_h} at {fps} FPS...")

    while True:
        raw_frame = reader.stdout.read(frame_size)
        if len(raw_frame) != frame_size:
            break

        frame = np.frombuffer(raw_frame, dtype=np.uint8).reshape((in_h, in_w, 3))

        # Real-ESRGAN Super Resolution
        enhanced_frame, _ = upscaler.enhance(frame, outscale=outscale)

        # GFPGAN Face Enhancement if enabled
        if face_enhancer is not None:
            _, _, enhanced_frame = face_enhancer.enhance(
                enhanced_frame,
                has_aligned=False,
                only_center_face=False,
                paste_back=True,
            )

        # Resize to strict even dimensions if needed
        if enhanced_frame.shape[1] != out_w or enhanced_frame.shape[0] != out_h:
            enhanced_frame = cv2.resize(enhanced_frame, (out_w, out_h), interpolation=cv2.INTER_LANCZOS4)

        writer.stdin.write(enhanced_frame.tobytes())
        frames_processed += 1

        if frames_processed % 30 == 0:
            print(f"Processed {frames_processed} frames...")

    reader.stdout.close()
    reader.wait()

    writer.stdin.close()
    writer.wait()

    if os.path.exists(temp_audio_path):
        os.remove(temp_audio_path)

    return frames_processed


def handler(job):
    """
    Main RunPod Serverless handler entrypoint
    """
    start_time = time.time()
    job_id = job.get("id", str(uuid.uuid4()))
    raw_input = job.get("input", {})

    print(f"--- [Job {job_id}] Started ---")

    try:
        validated = validate_input(raw_input)
        video_url = validated["video_url"]
        file_key = validated["file_key"]
        scale = validated["scale"]
        outscale = validated["outscale"]
        model_name = validated["model_name"]
        face_enhance = validated["face_enhance"]
        denoise_strength = validated["denoise_strength"]
        tile = validated["tile"]

        # Setup working temp directory
        work_dir = f"/tmp/{job_id}"
        os.makedirs(work_dir, exist_ok=True)

        input_filename = os.path.basename(file_key or video_url or "input.mp4")
        is_image = any(input_filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"])

        input_path = os.path.join(work_dir, f"input_{input_filename}")
        download_file(video_url, file_key, input_path)

        # Load models
        upscaler = get_upscaler(
            model_name=model_name,
            scale=scale,
            tile=tile,
            denoise_strength=denoise_strength,
        )

        face_enhancer = None
        if face_enhance:
            face_enhancer = get_face_enhancer(scale=outscale)

        # Process media
        if is_image:
            output_path = os.path.join(work_dir, "output.png")
            frames = process_image(input_path, output_path, upscaler, face_enhancer, outscale=outscale)
            content_type = "image/png"
            output_key = f"output-images/{job_id}_upscaled.png"
        else:
            output_path = os.path.join(work_dir, "output.mp4")
            frames = process_video(input_path, output_path, upscaler, face_enhancer, outscale=outscale)
            content_type = "video/mp4"
            output_key = f"output-videos/{job_id}_upscaled.mp4"

        # Upload output to Cloudflare R2
        output_url = upload_to_r2(output_path, output_key, content_type=content_type)

        elapsed = time.time() - start_time
        print(f"--- [Job {job_id}] Completed in {elapsed:.2f}s ({frames} frames) ---")

        # Cleanup
        shutil.rmtree(work_dir, ignore_errors=True)

        return {
            "output_url": output_url,
            "file_key": output_key,
            "frames_processed": frames,
            "process_time": round(elapsed, 2),
            "scale": scale,
            "model_name": model_name,
            "face_enhance": face_enhance,
        }

    except Exception as e:
        print(f"--- [Job {job_id}] ERROR: {str(e)} ---")
        import traceback
        traceback.print_exc()
        return {"error": str(e)}


if __name__ == "__main__":
    runpod.serverless.start({"handler": handler})
