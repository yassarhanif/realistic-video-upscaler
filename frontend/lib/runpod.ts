const apiKey = process.env.RUNPOD_API_KEY || "";
const endpointId = process.env.RUNPOD_ENDPOINT_ID || "";

export interface UpscaleJobInput {
  video_url?: string;
  file_key?: string;
  scale?: number;
  model_name?: string;
  face_enhance?: boolean;
  denoise_strength?: number;
  outscale?: number;
  batch_size?: number;
  uniform_batch_size?: boolean;
  color_correction?: string;
  input_noise_scale?: number;
  latent_noise_scale?: number;
  resolution?: number;
  max_resolution?: number;
  attention_mode?: string;
}

export type JobStatusType =
  | "IN_QUEUE"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"
  | "TIMED_OUT";

export interface RunPodJobResponse {
  id: string;
  status: JobStatusType;
  output?: {
    output_url?: string;
    file_key?: string;
    process_time?: number;
    frames_processed?: number;
    [key: string]: any;
  };
  error?: string;
  delayTime?: number;
  executionTime?: number;
}

/**
 * Trigger an asynchronous upscale job on RunPod Serverless
 */
export async function triggerRunPodJob(input: UpscaleJobInput): Promise<RunPodJobResponse> {
  if (!apiKey || !endpointId) {
    throw new Error("RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set in environment variables");
  }

  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/run`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ input }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RunPod trigger error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Check the status of an ongoing RunPod Serverless job
 */
export async function getRunPodJobStatus(jobId: string): Promise<RunPodJobResponse> {
  if (!apiKey || !endpointId) {
    throw new Error("RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set in environment variables");
  }

  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/status/${jobId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RunPod status error (${res.status}): ${errorText}`);
  }

  return await res.json();
}

/**
 * Cancel a running RunPod Serverless job
 */
export async function cancelRunPodJob(jobId: string): Promise<{ id: string; status: string }> {
  if (!apiKey || !endpointId) {
    throw new Error("RUNPOD_API_KEY or RUNPOD_ENDPOINT_ID is not set in environment variables");
  }

  const res = await fetch(`https://api.runpod.ai/v2/${endpointId}/cancel/${jobId}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`RunPod cancel error (${res.status}): ${errorText}`);
  }

  return await res.json();
}
