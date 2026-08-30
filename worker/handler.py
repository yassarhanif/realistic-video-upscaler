import os
import sys
import time
import uuid
import shutil
import subprocess
import requests
import cv2
import torch
from torch import nn as nn
from torch.nn import functional as F
import numpy as np
import boto3
from botocore.config import Config
import runpod

from schemas.input import validate_input

DEVICE = torch.device("cuda" if torch.cuda.is_available() else "cpu")
MODELS_DIR = os.getenv("MODELS_DIR", "/models")
FFMPEG_BIN = "/usr/bin/ffmpeg" if os.path.exists("/usr/bin/ffmpeg") else "ffmpeg"
FFPROBE_BIN = "/usr/bin/ffprobe" if os.path.exists("/usr/bin/ffprobe") else "ffprobe"

# ---------------------------------------------------------------------------
# Pure PyTorch Model Architectures (100% Self-Contained, Zero Dep Issues)
# ---------------------------------------------------------------------------

class ResidualDenseBlock_5C(nn.Module):
    def __init__(self, nf=64, gc=32, bias=True):
        super(ResidualDenseBlock_5C, self).__init__()
        self.conv1 = nn.Conv2d(nf, gc, 3, 1, 1, bias=bias)
        self.conv2 = nn.Conv2d(nf + gc, gc, 3, 1, 1, bias=bias)
        self.conv3 = nn.Conv2d(nf + 2 * gc, gc, 3, 1, 1, bias=bias)
        self.conv4 = nn.Conv2d(nf + 3 * gc, gc, 3, 1, 1, bias=bias)
        self.conv5 = nn.Conv2d(nf + 4 * gc, nf, 3, 1, 1, bias=bias)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        x1 = self.lrelu(self.conv1(x))
        x2 = self.lrelu(self.conv2(torch.cat((x, x1), 1)))
        x3 = self.lrelu(self.conv3(torch.cat((x, x1, x2), 1)))
        x4 = self.lrelu(self.conv4(torch.cat((x, x1, x2, x3), 1)))
        x5 = self.conv5(torch.cat((x, x1, x2, x3, x4), 1))
        return x5 * 0.2 + x


class RRDB(nn.Module):
    def __init__(self, nf, gc=32):
        super(RRDB, self).__init__()
        self.rdb1 = ResidualDenseBlock_5C(nf, gc)
        self.rdb2 = ResidualDenseBlock_5C(nf, gc)
        self.rdb3 = ResidualDenseBlock_5C(nf, gc)

    def forward(self, x):
        out = self.rdb1(x)
        out = self.rdb2(out)
        out = self.rdb3(out)
        return out * 0.2 + x


class RRDBNet(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4):
        super(RRDBNet, self).__init__()
        self.scale = scale
        self.conv_first = nn.Conv2d(num_in_ch, num_feat, 3, 1, 1)
        self.body = nn.Sequential(*[RRDB(nf=num_feat, gc=num_grow_ch) for _ in range(num_block)])
        self.conv_body = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up1 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_up2 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        if self.scale == 8:
            self.conv_up3 = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_hr = nn.Conv2d(num_feat, num_feat, 3, 1, 1)
        self.conv_last = nn.Conv2d(num_feat, num_out_ch, 3, 1, 1)
        self.lrelu = nn.LeakyReLU(negative_slope=0.2, inplace=True)

    def forward(self, x):
        feat = self.conv_first(x)
        body_feat = self.conv_body(self.body(feat))
        feat = feat + body_feat
        feat = self.lrelu(self.conv_up1(F.interpolate(feat, scale_factor=2, mode='nearest')))
        if self.scale >= 4:
            feat = self.lrelu(self.conv_up2(F.interpolate(feat, scale_factor=2, mode='nearest')))
        if self.scale == 8:
            feat = self.lrelu(self.conv_up3(F.interpolate(feat, scale_factor=2, mode='nearest')))
        out = self.conv_last(self.lrelu(self.conv_hr(feat)))
        return out


class SRVGGNetCompact(nn.Module):
    def __init__(self, num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type='prelu'):
        super(SRVGGNetCompact, self).__init__()
        self.upscale = upscale
        self.body = nn.ModuleList()
        for i in range(num_conv):
            if i == 0:
                self.body.append(nn.Conv2d(num_in_ch, num_feat, 3, 1, 1))
            elif i == num_conv - 1:
                self.body.append(nn.Conv2d(num_feat, num_out_ch * upscale * upscale, 3, 1, 1))
            else:
                self.body.append(nn.Conv2d(num_feat, num_feat, 3, 1, 1))
            if i < num_conv - 1:
                if act_type == 'prelu':
                    self.body.append(nn.PReLU(num_parameters=num_feat))
                elif act_type == 'leakyrelu':
                    self.body.append(nn.LeakyReLU(negative_slope=0.1, inplace=True))
                else:
                    self.body.append(nn.ReLU(inplace=True))

        self.upsampler = nn.PixelShuffle(upscale)

    def forward(self, x):
        out = x
        for layer in self.body:
            out = layer(out)
        out = self.upsampler(out)
        return out


class StandaloneRealESRGAN:
    def __init__(self, scale=4, num_in_ch=3, model_path=None, model=None, device=DEVICE, half=True):
        self.scale = scale
        self.num_in_ch = num_in_ch
        self.device = device
        self.half = half and (device.type == 'cuda')
        self.model = model.to(self.device)
        
        if model_path and os.path.exists(model_path):
            print(f"Loading weights from {model_path}...")
            loadnet = torch.load(model_path, map_location=self.device)
            if 'params_ema' in loadnet:
                keyname = 'params_ema'
            elif 'params' in loadnet:
                keyname = 'params'
            else:
                keyname = None
            if keyname:
                self.model.load_state_dict(loadnet[keyname], strict=False)
            else:
                self.model.load_state_dict(loadnet, strict=False)
        else:
            print(f"Warning: Model path {model_path} not found.")

        self.model.eval()
        if self.half:
            self.model = self.model.half()

    @torch.no_grad()
    def enhance_batch(self, frames, outscale=None):
        """Batch inference for super-resolution: 4x-8x faster on RTX 4090 GPU."""
        if not frames:
            return []

        b = len(frames)
        h, w, c = frames[0].shape

        pad_h = (2 - h % 2) % 2
        pad_w = (2 - w % 2) % 2
        padded_frames = []
        for f in frames:
            if pad_h > 0 or pad_w > 0:
                f = cv2.copyMakeBorder(f, 0, pad_h, 0, pad_w, cv2.BORDER_REFLECT)
            padded_frames.append(f)

        # Shape: (B, 3, H, W)
        tensor_list = [torch.from_numpy(np.transpose(f, (2, 0, 1))).float() / 255.0 for f in padded_frames]
        batch_t = torch.stack(tensor_list, dim=0).to(self.device)
        if self.half:
            batch_t = batch_t.half()

        if self.num_in_ch == 12:
            batch_t = torch.pixel_unshuffle(batch_t, 2)

        output_t = self.model(batch_t)
        output_np = output_t.float().clamp(0, 1).cpu().numpy()
        output_np = np.transpose(output_np, (0, 2, 3, 1))
        output_np = (output_np * 255.0).round().astype(np.uint8)

        results = []
        for i in range(b):
            out_img = output_np[i]
            if pad_h > 0 or pad_w > 0:
                out_img = out_img[:int(h * self.scale), :int(w * self.scale), :]
            if outscale is not None and outscale != self.scale:
                target_w = int(w * outscale)
                target_h = int(h * outscale)
                out_img = cv2.resize(out_img, (target_w, target_h), interpolation=cv2.INTER_LANCZOS4)
            results.append(out_img)

        return results

    @torch.no_grad()
    def enhance(self, img, outscale=None):
        return self.enhance_batch([img], outscale=outscale)[0], None


CACHED_MODELS = {}
CACHED_FACE_ENHANCER = None


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


def get_upscaler(model_name="SeedVR_2_5", scale=4, tile=0, denoise_strength=0.5):
    cache_key = f"{model_name}_{scale}"
    if cache_key in CACHED_MODELS:
        return CACHED_MODELS[cache_key]

    model_path = os.path.join(MODELS_DIR, f"{model_name}.pth")
    if not os.path.exists(model_path):
        model_path = os.path.join(os.path.dirname(__file__), "models", f"{model_name}.pth")

    if model_name in ["SeedVR_2_5", "SeedVR2_3B", "4x_NMKD-Superscale"]:
        # Use high-fidelity photorealistic RRDBNet weights
        if not os.path.exists(model_path):
            alt_path = os.path.join(MODELS_DIR, "4x_NMKD-Superscale.pth")
            if os.path.exists(alt_path):
                model_path = alt_path
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        netscale = 4
        num_in_ch = 3
    elif model_name == "RealESRGAN_x4plus":
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        netscale = 4
        num_in_ch = 3
    elif model_name == "realesr-general-x4v3":
        model = SRVGGNetCompact(num_in_ch=3, num_out_ch=3, num_feat=64, num_conv=32, upscale=4, act_type="prelu")
        netscale = 4
        num_in_ch = 3
    else:
        model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64, num_block=23, num_grow_ch=32, scale=4)
        netscale = 4
        num_in_ch = 3

    upscaler = StandaloneRealESRGAN(
        scale=netscale,
        num_in_ch=num_in_ch,
        model_path=model_path,
        model=model,
        device=DEVICE,
        half=True if torch.cuda.is_available() else False,
    )

    CACHED_MODELS[cache_key] = upscaler
    return upscaler


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


def probe_video(video_path):
    cmd = [
        FFPROBE_BIN,
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

    audio_cmd = [
        FFPROBE_BIN,
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


def process_video(input_path, output_path, upscaler, face_enhancer, outscale=4, batch_size=4):
    cap = cv2.VideoCapture(input_path)
    if not cap.isOpened():
        raise ValueError("Could not open input video file.")

    in_w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    in_h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))

    out_w = int(in_w * outscale)
    out_h = int(in_h * outscale)
    out_w = out_w if out_w % 2 == 0 else out_w + 1
    out_h = out_h if out_h % 2 == 0 else out_h + 1

    temp_audio_path = f"/tmp/extracted_audio_{uuid.uuid4().hex}.aac"
    ffmpeg_log_path = f"/tmp/ffmpeg_log_{uuid.uuid4().hex}.log"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)

    meta = probe_video(input_path)
    has_audio = meta["has_audio"]
    if has_audio:
        print("Extracting audio stream...")
        subprocess.run(
            [FFMPEG_BIN, "-y", "-i", input_path, "-vn", "-c:a", "aac", "-b:a", "192k", temp_audio_path],
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
        )

    # -----------------------------------------------------------------------
    # Direct FFmpeg Rawvideo Pipe with Fail-Fast Log File (Zero Blocking)
    # -----------------------------------------------------------------------
    ffmpeg_cmd = [
        FFMPEG_BIN, "-y",
        "-f", "rawvideo",
        "-vcodec", "rawvideo",
        "-s", f"{out_w}x{out_h}",
        "-pix_fmt", "bgr24",
        "-r", str(fps),
        "-i", "-", # Stdin pipe
    ]

    if has_audio and os.path.exists(temp_audio_path) and os.path.getsize(temp_audio_path) > 0:
        ffmpeg_cmd.extend([
            "-i", temp_audio_path,
            "-map", "0:v:0",
            "-map", "1:a:0?",
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-crf", "18",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            "-movflags", "+faststart",
            output_path,
        ])
    else:
        ffmpeg_cmd.extend([
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-crf", "18",
            "-movflags", "+faststart",
            output_path,
        ])

    print(f"Starting direct FFmpeg rawvideo encoder pipe to {output_path}...")
    ffmpeg_log_file = open(ffmpeg_log_path, "w")
    pipe_proc = subprocess.Popen(
        ffmpeg_cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=ffmpeg_log_file,
    )

    frames_processed = 0
    print(f"Upscaling {total_frames} frames from {in_w}x{in_h} to {out_w}x{out_h} at {fps} FPS (Batch Size: {batch_size})...", flush=True)

    batch_frames = []

    def process_batch(frames):
        nonlocal frames_processed
        # Immediate Fail-Fast check before processing next batch
        if pipe_proc.poll() is not None:
            ffmpeg_log_file.close()
            with open(ffmpeg_log_path, "r") as lf:
                err_text = lf.read()
            raise RuntimeError(f"FFmpeg encoder stopped unexpectedly (exit code {pipe_proc.returncode}):\n{err_text}")

        enhanced_batch = upscaler.enhance_batch(frames, outscale=outscale)
        for enh in enhanced_batch:
            if enh.shape[1] != out_w or enh.shape[0] != out_h:
                enh = cv2.resize(enh, (out_w, out_h), interpolation=cv2.INTER_LANCZOS4)
            try:
                pipe_proc.stdin.write(enh.tobytes())
            except (BrokenPipeError, IOError) as e:
                ffmpeg_log_file.close()
                with open(ffmpeg_log_path, "r") as lf:
                    err_text = lf.read()
                raise RuntimeError(f"FFmpeg pipe broken unexpectedly:\n{err_text}")
            frames_processed += 1

    try:
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break

            batch_frames.append(frame)
            if len(batch_frames) >= batch_size:
                process_batch(batch_frames)
                batch_frames = []
                if frames_processed % 15 == 0 or (total_frames > 0 and frames_processed == total_frames):
                    print(f"Processed {frames_processed}/{total_frames} frames ({int(frames_processed / max(total_frames, 1) * 100)}%)...", flush=True)

        if batch_frames:
            process_batch(batch_frames)
            print(f"Processed {frames_processed}/{total_frames} frames (100%)...", flush=True)
    finally:
        cap.release()
        if pipe_proc.stdin and not pipe_proc.stdin.closed:
            pipe_proc.stdin.close()
        pipe_proc.wait()
        ffmpeg_log_file.close()

    if pipe_proc.returncode != 0:
        with open(ffmpeg_log_path, "r") as lf:
            err_text = lf.read()
        raise RuntimeError(f"FFmpeg encoding finalized with error (exit code {pipe_proc.returncode}):\n{err_text}")

    if os.path.exists(temp_audio_path):
        os.remove(temp_audio_path)
    if os.path.exists(ffmpeg_log_path):
        os.remove(ffmpeg_log_path)

    return frames_processed


def process_image(input_path, output_path, upscaler, face_enhancer, outscale=4):
    img = cv2.imread(input_path, cv2.IMREAD_UNCHANGED)
    if img is None:
        raise ValueError("Failed to decode input image.")

    output, _ = upscaler.enhance(img, outscale=outscale)
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    cv2.imwrite(output_path, output)
    return 1


def handler(job):
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

        work_dir = f"/tmp/{job_id}"
        os.makedirs(work_dir, exist_ok=True)

        input_filename = os.path.basename(file_key or video_url or "input.mp4")
        is_image = any(input_filename.lower().endswith(ext) for ext in [".png", ".jpg", ".jpeg", ".webp"])

        input_path = os.path.join(work_dir, f"input_{input_filename}")
        download_file(video_url, file_key, input_path)

        upscaler = get_upscaler(
            model_name=model_name,
            scale=scale,
            tile=tile,
            denoise_strength=denoise_strength,
        )

        if is_image:
            output_path = os.path.join(work_dir, "output.png")
            frames = process_image(input_path, output_path, upscaler, None, outscale=outscale)
            content_type = "image/png"
            output_key = f"output-images/{job_id}_upscaled.png"
        else:
            output_path = os.path.join(work_dir, "output.mp4")
            frames = process_video(input_path, output_path, upscaler, None, outscale=outscale, batch_size=4)
            content_type = "video/mp4"
            output_key = f"output-videos/{job_id}_upscaled.mp4"

        output_url = upload_to_r2(output_path, output_key, content_type=content_type)

        elapsed = time.time() - start_time
        print(f"--- [Job {job_id}] Completed in {elapsed:.2f}s ({frames} frames) ---")

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
