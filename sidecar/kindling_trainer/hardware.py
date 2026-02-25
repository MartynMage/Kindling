"""Hardware detection utilities."""

import json


def detect_hardware():
    info = {
        "cuda_available": False,
        "gpu_name": None,
        "vram_gb": None,
        "recommended_batch_size": 1,
    }

    try:
        import torch

        info["cuda_available"] = torch.cuda.is_available()
        if info["cuda_available"]:
            info["gpu_name"] = torch.cuda.get_device_name(0)
            vram_bytes = torch.cuda.get_device_properties(0).total_memory
            info["vram_gb"] = round(vram_bytes / (1024**3), 1)

            # Recommend batch size based on VRAM
            if info["vram_gb"] >= 16:
                info["recommended_batch_size"] = 8
            elif info["vram_gb"] >= 8:
                info["recommended_batch_size"] = 4
            elif info["vram_gb"] >= 4:
                info["recommended_batch_size"] = 2
            else:
                info["recommended_batch_size"] = 1
    except (ImportError, AttributeError, RuntimeError):
        pass

    return info


if __name__ == "__main__":
    print(json.dumps(detect_hardware()))
