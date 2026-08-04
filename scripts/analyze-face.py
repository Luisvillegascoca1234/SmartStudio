import json
import sys
from pathlib import Path

import mediapipe as mp


def main():
    source = sys.argv[1]
    model_path = Path(sys.argv[2])
    if not model_path.is_file():
        print(json.dumps({"available": False, "faces": []}))
        return

    options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(model_path)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_faces=20,
        min_face_detection_confidence=.55,
        min_face_presence_confidence=.55,
        output_face_blendshapes=True,
    )
    image = mp.Image.create_from_file(source)
    with mp.tasks.vision.FaceLandmarker.create_from_options(options) as landmarker:
        result = landmarker.detect(image)

    faces = []
    for index, landmarks in enumerate(result.face_landmarks):
        blendshapes = {
            category.category_name: float(category.score)
            for category in (result.face_blendshapes[index] if index < len(result.face_blendshapes) else [])
        }
        faces.append({
            "bounds": {
                "minX": min(point.x for point in landmarks),
                "maxX": max(point.x for point in landmarks),
                "minY": min(point.y for point in landmarks),
                "maxY": max(point.y for point in landmarks),
            },
            "blinkLeft": blendshapes.get("eyeBlinkLeft", 0.0),
            "blinkRight": blendshapes.get("eyeBlinkRight", 0.0),
        })
    print(json.dumps({"available": True, "faces": faces}))


if __name__ == "__main__":
    main()
