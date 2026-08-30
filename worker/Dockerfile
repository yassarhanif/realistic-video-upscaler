FROM pytorch/pytorch:2.2.0-cuda12.1-cudnn8-runtime

ENV DEBIAN_FRONTEND=noninteractive
ENV PYTHONUNBUFFERED=1
ENV MODELS_DIR=/models

WORKDIR /app

# Install system dependencies & FFmpeg
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    libgl1 \
    libglib2.0-0 \
    git \
    wget \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Python requirements
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Install Real-ESRGAN package
RUN pip install --no-cache-dir realesrgan

# Create models directory and pre-bake realistic weights into Docker image
RUN mkdir -p /models && \
    wget -q -O /models/RealESRGAN_x4plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth && \
    wget -q -O /models/RealESRGAN_x2plus.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.1/RealESRGAN_x2plus.pth && \
    wget -q -O /models/realesr-general-x4v3.pth https://github.com/xinntao/Real-ESRGAN/releases/download/v0.2.5.0/realesr-general-x4v3.pth && \
    wget -q -O /models/GFPGANv1.3.pth https://github.com/TencentARC/GFPGAN/releases/download/v1.3.0/GFPGANv1.3.pth

# Pre-download FaceXLib detection & parsing models
RUN mkdir -p /root/.cache/facexlib/weights && \
    wget -q -O /root/.cache/facexlib/weights/detection_Resnet50_Final.pth https://github.com/xinntao/facexlib/releases/download/v0.1.0/detection_Resnet50_Final.pth && \
    wget -q -O /root/.cache/facexlib/weights/parsing_parsenet.pth https://github.com/xinntao/facexlib/releases/download/v0.2.2/parsing_parsenet.pth

# Copy application files
COPY schemas/ /app/schemas/
COPY handler.py /app/
COPY start.sh /start.sh

RUN chmod +x /start.sh

CMD ["/start.sh"]
