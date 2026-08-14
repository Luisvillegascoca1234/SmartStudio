import importlib.util
import json
import sys
import time
from pathlib import Path


def load_engine():
    script = Path(__file__).with_name("portrait-retouch.py")
    spec = importlib.util.spec_from_file_location("smartstudio_portrait_retouch", script)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def main():
    model_directory = Path(sys.argv[1])
    engine = load_engine()
    warmup = engine.warm_models(model_directory)
    print(json.dumps({"type": "ready", **warmup}), flush=True)
    provider_request_counts = {}
    for line in sys.stdin:
        if not line.strip():
            continue
        request = json.loads(line)
        request_id = request["id"]
        started = time.perf_counter()
        try:
            result = engine.process_image(
                request["source"],
                request["destination"],
                request["skinLevel"],
                request.get("fixture"),
                model_directory,
                Path(request["cleanPlatePath"]) if request.get("cleanPlatePath") else None,
                request.get("matteProvider"),
            )
            session_key = f'{result["matte"]["provider"]}:{result["matte"]["model"]}:{result["matte"]["processingRoute"]}'
            result["matte"]["sessionReused"] = provider_request_counts.get(session_key, 0) > 0
            provider_request_counts[session_key] = provider_request_counts.get(session_key, 0) + 1
            result["matte"]["warmupMilliseconds"] = warmup["warmupMilliseconds"]
            response = {
                "type": "result",
                "id": request_id,
                "result": result,
                "durationMilliseconds": round((time.perf_counter() - started) * 1000),
            }
        except Exception as error:
            response = {"type": "error", "id": request_id, "error": str(error)}
        print(json.dumps(response), flush=True)


if __name__ == "__main__":
    main()
