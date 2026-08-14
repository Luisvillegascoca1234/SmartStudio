import json
import sys
from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np


def main():
    image_path = Path(sys.argv[1])
    model_directory = Path(sys.argv[2])
    image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("No se pudo leer la placa limpia.")

    segment_model = model_directory / "selfie_multiclass_256x256.tflite"
    face_model = model_directory / "face_landmarker.task"
    if not segment_model.is_file() or not face_model.is_file():
        raise RuntimeError("Faltan los modelos locales necesarios para validar la placa limpia.")

    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    segment_options = mp.tasks.vision.ImageSegmenterOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(segment_model)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        output_category_mask=True,
        output_confidence_masks=False,
    )
    with mp.tasks.vision.ImageSegmenter.create_from_options(segment_options) as segmenter:
        result = segmenter.segment(mp_image)
        category = np.squeeze(np.array(result.category_mask.numpy_view(), copy=True))
    person_coverage = float(np.mean(category > 0))

    face_options = mp.tasks.vision.FaceLandmarkerOptions(
        base_options=mp.tasks.BaseOptions(model_asset_path=str(face_model)),
        running_mode=mp.tasks.vision.RunningMode.IMAGE,
        num_faces=5,
        min_face_detection_confidence=.45,
        min_face_presence_confidence=.45,
    )
    with mp.tasks.vision.FaceLandmarker.create_from_options(face_options) as detector:
        face_count = len(detector.detect(mp_image).face_landmarks)

    print(json.dumps({
        "personDetected": face_count > 0 or person_coverage >= .02,
        "personCoverage": person_coverage,
        "faceCount": face_count,
    }))


if __name__ == "__main__":
    main()
