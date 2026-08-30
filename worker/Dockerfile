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

# Pre-download validated models
RUN mkdir -p /models && \
    curl -L -o /models/4x_NMKD-Superscale.pth https://huggingface.co/gemasai/4x_NMKD-Superscale-SP_178000_G/resolve/main/4x_NMKD-Superscale-SP_178000_G.pth && \
    curl -L -o /models/RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth && \
    curl -L -o /models/realesr-general-x4v3.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth

# Copy application files
COPY schemas/ /app/schemas/
COPY handler.py /app/
COPY start.sh /start.sh

RUN chmod +x /start.sh

CMD ["/start.sh"]
