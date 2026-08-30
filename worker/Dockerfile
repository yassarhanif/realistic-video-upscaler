FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV PATH="/usr/bin:${PATH}"
ENV MODELS_DIR=/models

WORKDIR /app

# Install full system FFmpeg with libx264 & system libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    git \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Ensure system FFmpeg takes absolute precedence over stripped conda ffmpeg
RUN rm -f /opt/conda/bin/ffmpeg /opt/conda/bin/ffprobe || true

# Install Python requirements
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Clone official SeedVR2 engine repository
RUN git clone --depth 1 https://github.com/numz/ComfyUI-SeedVR2_VideoUpscaler.git /app/seedvr2

# Pre-download official ByteDance SeedVR2-3B FP8 weights & VAE into /models/SEEDVR2
RUN mkdir -p /models/SEEDVR2 && \
    curl -L -o /models/SEEDVR2/seedvr2_ema_3b_fp8_e4m3fn.safetensors https://huggingface.co/numz/SeedVR2_comfyUI/resolve/main/seedvr2_ema_3b_fp8_e4m3fn.safetensors && \
    curl -L -o /models/SEEDVR2/ema_vae_fp16.safetensors https://huggingface.co/numz/SeedVR2_comfyUI/resolve/main/ema_vae_fp16.safetensors

ENV PYTHONPATH="/app/seedvr2:/app:${PYTHONPATH}"

# Copy application files
COPY schemas/ /app/schemas/
COPY handler.py /app/
COPY start.sh /start.sh

RUN chmod +x /start.sh

CMD ["/start.sh"]

