import json
import os
import shutil
import sys
from pathlib import Path

import cv2
import numpy as np


FACE_OVAL = [
    10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365,
    379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93,
    234, 127, 162, 21, 54, 103, 67, 109,
]
LEFT_EYE = [33, 160, 158, 133, 153, 144]
RIGHT_EYE = [362, 385, 387, 263, 373, 380]
LEFT_IRIS = [468, 469, 470, 471, 472]
RIGHT_IRIS = [473, 474, 475, 476, 477]
INNER_MOUTH = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95]


def ellipse_mask(shape, face):
    mask = np.zeros(shape[:2], dtype=np.uint8)
    x, y, w, h = face
    cv2.ellipse(mask, (x + w // 2, y + h // 2), (int(w * .43), int(h * .48)), 0, 0, 360, 255, -1)
    return mask


def confident_eye_pair(eyes, face_width, face_height):
    if len(eyes) != 2:
        return []
    ordered = sorted(eyes, key=lambda eye: eye[0])
    left, right = ordered
    left_center = (left[0] + left[2] / 2, left[1] + left[3] / 2)
    right_center = (right[0] + right[2] / 2, right[1] + right[3] / 2)
    similar_size = .55 <= left[2] / max(right[2], 1) <= 1.8 and .55 <= left[3] / max(right[3], 1) <= 1.8
    aligned = abs(left_center[1] - right_center[1]) <= face_height * .12
    separated = right_center[0] - left_center[0] >= face_width * .18
    return ordered if similar_size and aligned and separated else []


def apply_controlled(image, level, controlled_arg):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = image.shape[:2]
    if controlled_arg in ("controlled:backdrop", "controlled:backdrop-uncertain-mask"):
        person_mask = np.zeros((height, width), dtype=np.uint8)
        cv2.ellipse(person_mask, (width // 2, int(height * .58)), (int(width * .18), int(height * .38)), 0, 0, 360, 255, -1)
        image, backdrop, warning = complete_uniform_backdrop(
            image,
            person_mask,
            controlled_arg != "controlled:backdrop-uncertain-mask",
        )
        return image, {
            "faces": 0,
            "treated": 0,
            "warnings": [warning] if warning else [],
            "backdrop": backdrop,
        }
    if controlled_arg.startswith("controlled:") and controlled_arg.removeprefix("controlled:").isdigit():
        face_count = max(1, int(controlled_arg.removeprefix("controlled:")))
        face_width = .82 / face_count
        faces = [
            (int(width * (.04 + index * (.92 / face_count))), int(height * .15), int(width * face_width), int(height * .55))
            for index in range(face_count)
        ]
    else:
        faces = [(int(width * .63), int(height * .07), int(width * .31), int(height * .48))]
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    smile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")
    warnings = []
    treated = 0
    for x, y, w, h in faces:
        mask = ellipse_mask(image.shape, (x, y, w, h))
        if level > 0:
            smooth = cv2.bilateralFilter(image, 5 if level == 1 else 7, 22 if level == 1 else 32, 22 if level == 1 else 32)
            alpha = cv2.GaussianBlur(mask, (0, 0), 3).astype(np.float32)[:, :, None] / 255
            strength = .20 if level == 1 else .34
            image = np.clip(image * (1 - alpha * strength) + smooth * alpha * strength, 0, 255).astype(np.uint8)
        roi_gray = gray[y:y+h, x:x+w]
        eyes = list(eye_cascade.detectMultiScale(roi_gray[:h//2], 1.1, 5, minSize=(18, 12)))
        if controlled_arg != "controlled:uncertain" and not eyes:
            eyes = [(int(w*.18), int(h*.32), int(w*.18), int(h*.12)), (int(w*.62), int(h*.32), int(w*.18), int(h*.12))]
        eyes = confident_eye_pair(eyes, w, h)
        if not eyes:
            warnings.append("No se detectaron ambos ojos con confianza en un rostro; se omitió su mejora.")
        for ex, ey, ew, eh in eyes:
            eye = image[y+ey:y+ey+eh, x+ex:x+ex+ew]
            blue, green, red = cv2.split(eye)
            red_pixels = (red.astype(np.float32) > green * 1.35) & (red.astype(np.float32) > blue * 1.35)
            red[red_pixels] = ((green[red_pixels].astype(np.uint16) + blue[red_pixels].astype(np.uint16)) // 2).astype(np.uint8)
            corrected = cv2.merge((blue, green, red))
            image[y+ey:y+ey+eh, x+ex:x+ex+ew] = cv2.addWeighted(
                corrected, 1.08, cv2.GaussianBlur(corrected, (0, 0), 1), -.08, 3,
            )
        smiles = list(smile_cascade.detectMultiScale(roi_gray[h//2:], 1.5, 20, minSize=(25, 10)))
        if controlled_arg != "controlled:uncertain" and not smiles:
            smiles = [(int(w*.32), int(h*.25), int(w*.36), int(h*.12))]
        if controlled_arg == "controlled:uncertain":
            smiles = []
        if not smiles:
            warnings.append("No se detectaron dientes con confianza en un rostro; se omitió el blanqueamiento.")
        for sx, sy, sw, sh in smiles[:1]:
            sy += h // 2
            mouth = image[y+sy:y+sy+sh, x+sx:x+sx+sw]
            hsv = cv2.cvtColor(mouth, cv2.COLOR_BGR2HSV)
            candidate = (hsv[:, :, 1] < 110) & (hsv[:, :, 2] > 105)
            hsv[:, :, 1][candidate] = (hsv[:, :, 1][candidate] * .78).astype(np.uint8)
            hsv[:, :, 2][candidate] = np.minimum(hsv[:, :, 2][candidate].astype(np.uint16) + 8, 235).astype(np.uint8)
            image[y+sy:y+sy+sh, x+sx:x+sx+sw] = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        treated += 1
    return image, {"faces": len(faces), "treated": treated, "warnings": warnings, "backdrop": "unchanged"}


def polygon_mask(shape, landmarks, indices, padding=0):
    points = np.array([
        (int(landmarks[index].x * shape[1]), int(landmarks[index].y * shape[0]))
        for index in indices
        if index < len(landmarks)
    ], dtype=np.int32)
    mask = np.zeros(shape[:2], dtype=np.uint8)
    if len(points) >= 3:
        cv2.fillConvexPoly(mask, cv2.convexHull(points), 255)
        if padding:
            size = padding * 2 + 1
            mask = cv2.dilate(mask, np.ones((size, size), np.uint8))
    return mask


def enhance_eyes(image, landmarks):
    for eye_indices, iris_indices in ((LEFT_EYE, LEFT_IRIS), (RIGHT_EYE, RIGHT_IRIS)):
        eye_mask = polygon_mask(image.shape, landmarks, eye_indices, max(2, image.shape[1] // 1000))
        if not np.any(eye_mask):
            continue
        x, y, w, h = cv2.boundingRect(eye_mask)
        region = image[y:y+h, x:x+w]
        local_mask = eye_mask[y:y+h, x:x+w].astype(np.float32)[:, :, None] / 255
        detail = cv2.addWeighted(region, 1.12, cv2.GaussianBlur(region, (0, 0), 1), -0.12, 2)
        image[y:y+h, x:x+w] = np.clip(region * (1 - local_mask * .32) + detail * local_mask * .32, 0, 255).astype(np.uint8)

        iris_mask = polygon_mask(image.shape, landmarks, iris_indices)
        if np.any(iris_mask):
            red, green, blue = image[:, :, 2], image[:, :, 1], image[:, :, 0]
            red_pixels = (
                (iris_mask > 0)
                & (red.astype(np.float32) > 145)
                & (red.astype(np.float32) > green * 1.5)
                & (red.astype(np.float32) > blue * 1.5)
            )
            red[red_pixels] = ((green[red_pixels].astype(np.uint16) + blue[red_pixels].astype(np.uint16)) // 2).astype(np.uint8)
    return image


def whiten_teeth(image, landmarks):
    mouth_mask = polygon_mask(image.shape, landmarks, INNER_MOUTH)
    if not np.any(mouth_mask):
        return image, False
    x, y, w, h = cv2.boundingRect(mouth_mask)
    mouth = image[y:y+h, x:x+w]
    local_mask = mouth_mask[y:y+h, x:x+w] > 0
    hsv = cv2.cvtColor(mouth, cv2.COLOR_BGR2HSV)
    candidate = local_mask & (hsv[:, :, 1] < 105) & (hsv[:, :, 2] > 120)
    if np.count_nonzero(candidate) < max(10, int(w * h * .012)):
        return image, False
    corrected_hsv = hsv.copy()
    corrected_hsv[:, :, 1][candidate] = (corrected_hsv[:, :, 1][candidate] * .88).astype(np.uint8)
    corrected_hsv[:, :, 2][candidate] = np.minimum(corrected_hsv[:, :, 2][candidate].astype(np.uint16) + 5, 238).astype(np.uint8)
    corrected = cv2.cvtColor(corrected_hsv, cv2.COLOR_HSV2BGR)
    alpha = cv2.GaussianBlur(candidate.astype(np.uint8) * 255, (0, 0), 1.2).astype(np.float32)[:, :, None] / 255 * .55
    image[y:y+h, x:x+w] = np.clip(mouth * (1 - alpha) + corrected * alpha, 0, 255).astype(np.uint8)
    return image, True


def estimate_backdrop_plane(analysis_image, background_mask):
    analysis_height, analysis_width = background_mask.shape
    rows, columns = np.mgrid[:analysis_height, :analysis_width]
    side_regions = (columns <= analysis_width * .32) | (columns >= analysis_width * .68)
    backdrop_reference_region = (
        background_mask
        & side_regions
        & (rows >= analysis_height * .38)
        & (rows <= analysis_height * .92)
    )
    reference_count = np.count_nonzero(backdrop_reference_region)
    if reference_count < analysis_width * analysis_height * .08:
        return None, None, None, None, "No hubo suficiente fondo visible y limpio para completarlo con confianza."

    analysis_lab = cv2.cvtColor(analysis_image, cv2.COLOR_BGR2LAB).astype(np.float32)
    reference_color = np.median(analysis_lab[backdrop_reference_region], axis=0)
    reference_distance = np.linalg.norm(analysis_lab - reference_color, axis=2)
    uniformity = float(np.percentile(reference_distance[backdrop_reference_region], 60))
    if uniformity > 14:
        return None, None, None, None, "El fondo no era suficientemente uniforme; se omitió su completado."

    clean_threshold = max(5, uniformity)
    clean_backdrop_samples = backdrop_reference_region & (reference_distance <= clean_threshold)
    clean_columns = columns[clean_backdrop_samples]
    clean_rows = rows[clean_backdrop_samples]
    if (
        np.count_nonzero(clean_backdrop_samples) < reference_count * .42
        or np.ptp(clean_columns) < analysis_width * .55
        or np.ptp(clean_rows) < analysis_height * .18
    ):
        return None, None, None, None, "Las regiones limpias del fondo no cubrían suficiente área para reconstruirlo."

    sample_positions = np.column_stack((
        clean_columns.astype(np.float32) / analysis_width,
        clean_rows.astype(np.float32) / analysis_height,
        np.ones(np.count_nonzero(clean_backdrop_samples), dtype=np.float32),
    ))
    plane_coefficients = np.linalg.lstsq(
        sample_positions,
        analysis_image[clean_backdrop_samples].astype(np.float32),
        rcond=None,
    )[0]
    all_positions = np.column_stack((
        columns.ravel().astype(np.float32) / analysis_width,
        rows.ravel().astype(np.float32) / analysis_height,
        np.ones(analysis_width * analysis_height, dtype=np.float32),
    ))
    estimated_backdrop = np.clip(all_positions @ plane_coefficients, 0, 255).reshape(
        analysis_height,
        analysis_width,
        3,
    ).astype(np.uint8)
    return estimated_backdrop, clean_backdrop_samples, reference_distance, clean_threshold, None


def backdrop_has_interruption(analysis_image, estimated_backdrop, background_mask, clean_samples, reference_distance, clean_threshold):
    analysis_height, analysis_width = background_mask.shape
    estimated_lab = cv2.cvtColor(estimated_backdrop, cv2.COLOR_BGR2LAB).astype(np.float32)
    analysis_lab = cv2.cvtColor(analysis_image, cv2.COLOR_BGR2LAB).astype(np.float32)
    distance_from_plane = np.linalg.norm(analysis_lab - estimated_lab, axis=2)
    plane_residual = float(np.median(distance_from_plane[clean_samples]))
    different_from_plane = background_mask & (distance_from_plane > max(6.5, plane_residual * 2.2))

    clean_backdrop = background_mask & (reference_distance <= clean_threshold)
    minimum_run = max(4, analysis_height // 90)
    maximum_extension_start = round(analysis_height * .58)
    upper_extension_mask = np.zeros_like(background_mask, dtype=np.uint8)
    for column in range(analysis_width):
        clean_run = np.convolve(clean_backdrop[:, column].astype(np.uint8), np.ones(minimum_run, dtype=np.uint8), mode="valid")
        run_starts = np.flatnonzero(clean_run == minimum_run)
        if len(run_starts) and minimum_run <= run_starts[0] <= maximum_extension_start:
            upper_extension_mask[:run_starts[0], column] = background_mask[:run_starts[0], column]

    morphology_size = max(5, analysis_width // 70)
    if morphology_size % 2 == 0:
        morphology_size += 1
    upper_extension_mask = cv2.morphologyEx(
        upper_extension_mask,
        cv2.MORPH_CLOSE,
        np.ones((morphology_size, morphology_size), np.uint8),
    )
    extension_pixels = np.count_nonzero(upper_extension_mask)
    extension_columns = np.count_nonzero(np.any(upper_extension_mask > 0, axis=0))
    differing_extension_pixels = np.count_nonzero((upper_extension_mask > 0) & different_from_plane)
    confirmed = (
        extension_pixels >= analysis_width * analysis_height * .015
        and extension_columns >= analysis_width * .35
        and differing_extension_pixels >= extension_pixels * .22
    )
    if confirmed:
        return "confirmed"
    if np.count_nonzero(different_from_plane) >= analysis_width * analysis_height * .01:
        return "ambiguous"
    return "none"


def composite_completed_backdrop(image, person_mask, estimated_backdrop, analysis_background_mask):
    height, width = image.shape[:2]
    full_backdrop = cv2.resize(estimated_backdrop, (width, height), interpolation=cv2.INTER_LINEAR)
    replacement_mask = cv2.resize(
        analysis_background_mask.astype(np.float32),
        (width, height),
        interpolation=cv2.INTER_LINEAR,
    )
    protection_radius = max(2, round(min(width, height) * .001))
    protected_person = cv2.dilate(
        person_mask,
        np.ones((protection_radius * 2 + 1, protection_radius * 2 + 1), np.uint8),
    ) > 0
    replacement_mask[protected_person] = 0
    blend = cv2.GaussianBlur(
        replacement_mask,
        (0, 0),
        max(2.0, min(width, height) / 450),
    )[:, :, None]
    blend[protected_person] = 0
    return np.clip(image * (1 - blend) + full_backdrop * blend, 0, 255).astype(np.uint8)


def complete_uniform_backdrop(image, person_mask, segmentation_confident=True):
    if not segmentation_confident:
        return image, "omitted", "La máscara de la persona no tuvo suficiente confianza; se conservó el fondo original."
    height, width = image.shape[:2]
    analysis_width = min(480, width)
    analysis_height = max(1, round(height * analysis_width / width))
    analysis_image = cv2.resize(image, (analysis_width, analysis_height), interpolation=cv2.INTER_AREA)
    analysis_person_mask = cv2.resize(
        person_mask,
        (analysis_width, analysis_height),
        interpolation=cv2.INTER_NEAREST,
    ) > 0
    analysis_background_mask = ~analysis_person_mask
    estimated_backdrop, clean_samples, reference_distance, clean_threshold, warning = estimate_backdrop_plane(
        analysis_image,
        analysis_background_mask,
    )
    if warning:
        return image, "omitted", warning
    interruption = backdrop_has_interruption(
        analysis_image,
        estimated_backdrop,
        analysis_background_mask,
        clean_samples,
        reference_distance,
        clean_threshold,
    )
    if interruption == "ambiguous":
        return image, "omitted", "No se distinguió con confianza el fondo uniforme de otras superficies; se conservó el original."
    if interruption == "none":
        return image, "unchanged", None
    completed = composite_completed_backdrop(image, person_mask, estimated_backdrop, analysis_background_mask)
    return completed, "completed", None


def confident_segmentation(category_mask, confidence_masks):
    height, width = category_mask.shape
    analysis_width = min(320, width)
    analysis_height = max(1, round(height * analysis_width / width))
    small_category = cv2.resize(category_mask, (analysis_width, analysis_height), interpolation=cv2.INTER_NEAREST)
    resized_confidence = [
        cv2.resize(np.squeeze(mask.numpy_view()), (analysis_width, analysis_height), interpolation=cv2.INTER_AREA)
        for mask in confidence_masks
    ]
    if not resized_confidence:
        return False
    best_confidence = np.maximum.reduce(resized_confidence)
    person = small_category > 0
    if np.count_nonzero(person) < analysis_width * analysis_height * .02:
        return False
    return (
        float(np.mean(best_confidence)) >= .72
        and float(np.mean(best_confidence < .55)) <= .12
        and float(np.mean(best_confidence[person])) >= .68
    )


def apply_mediapipe(image, level, model_directory):
    import mediapipe as mp

    face_model = model_directory / "face_landmarker.task"
    segment_model = model_directory / "selfie_multiclass_256x256.tflite"
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    face_landmarks = []
    warnings = []
    if face_model.is_file():
        face_options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(face_model)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_faces=20,
            min_face_detection_confidence=.55,
            min_face_presence_confidence=.55,
            output_face_blendshapes=False,
        )
        with mp.tasks.vision.FaceLandmarker.create_from_options(face_options) as landmarker:
            face_landmarks = landmarker.detect(mp_image).face_landmarks
    else:
        warnings.append("Falta el modelo local de landmarks faciales; se omitió el retoque facial.")

    category_mask = None
    if segment_model.is_file():
        segment_options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(segment_model)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            output_category_mask=True,
            output_confidence_masks=True,
        )
        with mp.tasks.vision.ImageSegmenter.create_from_options(segment_options) as segmenter:
            segment_result = segmenter.segment(mp_image)
            category_mask = np.squeeze(np.array(segment_result.category_mask.numpy_view(), copy=True))
            segmentation_confident = confident_segmentation(category_mask, segment_result.confidence_masks)
        if category_mask.shape != image.shape[:2]:
            category_mask = cv2.resize(category_mask, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_NEAREST)
    else:
        warnings.append("Falta el modelo local de segmentación; se omitió el suavizado de piel.")

    backdrop = "omitted"
    if category_mask is not None:
        person_mask = np.where(category_mask > 0, 255, 0).astype(np.uint8)
        image, backdrop, backdrop_warning = complete_uniform_backdrop(image, person_mask, segmentation_confident)
        if backdrop_warning:
            warnings.append(backdrop_warning)
    else:
        warnings.append("Falta la segmentación local; se omitió el completado del fondo.")

    if not face_landmarks:
        if face_model.is_file():
            warnings.append("No se detectaron rostros; no se aplicó retoque facial.")
        return image, {"faces": 0, "treated": 0, "warnings": warnings, "backdrop": backdrop}

    treated = 0
    for landmarks in face_landmarks:
        face_mask = polygon_mask(image.shape, landmarks, FACE_OVAL)
        eyes_and_mouth = cv2.bitwise_or(
            cv2.bitwise_or(polygon_mask(image.shape, landmarks, LEFT_EYE, 3), polygon_mask(image.shape, landmarks, RIGHT_EYE, 3)),
            polygon_mask(image.shape, landmarks, INNER_MOUTH, 3),
        )
        skin_mask = None
        if category_mask is not None:
            segmented_skin = np.where(category_mask == 3, 255, 0).astype(np.uint8)
            candidate = cv2.bitwise_and(cv2.bitwise_and(face_mask, cv2.bitwise_not(eyes_and_mouth)), segmented_skin)
            if np.count_nonzero(candidate) >= max(40, int(np.count_nonzero(face_mask) * .18)):
                skin_mask = candidate
            else:
                warnings.append("No se segmentó piel con confianza en un rostro; se omitió su suavizado.")
        if level > 0 and skin_mask is not None and np.any(skin_mask):
            x, y, w, h = cv2.boundingRect(face_mask)
            region = image[y:y+h, x:x+w]
            local_mask = skin_mask[y:y+h, x:x+w]
            smooth = cv2.bilateralFilter(region, 7 if level == 1 else 9, 28 if level == 1 else 42, 28 if level == 1 else 42)
            alpha = cv2.GaussianBlur(local_mask, (0, 0), max(2, w / 180)).astype(np.float32)[:, :, None] / 255
            strength = .24 if level == 1 else .38
            image[y:y+h, x:x+w] = np.clip(region * (1 - alpha * strength) + smooth * alpha * strength, 0, 255).astype(np.uint8)
        image = enhance_eyes(image, landmarks)
        image, teeth_found = whiten_teeth(image, landmarks)
        if not teeth_found:
            warnings.append("No se distinguieron dientes visibles con confianza; se omitió el blanqueamiento.")
        treated += 1
    return image, {"faces": len(face_landmarks), "treated": treated, "warnings": warnings, "backdrop": backdrop}


def main():
    source, destination = sys.argv[1], sys.argv[2]
    level = min(2, max(0, int(sys.argv[3])))
    controlled_arg = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "-" else ""
    default_models = Path(os.environ.get("SMARTSTUDIO_MODEL_DIR", Path.cwd() / ".smartstudio-data" / "models"))
    model_directory = Path(sys.argv[5]) if len(sys.argv) > 5 else default_models
    image = cv2.imread(source, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("No se pudo leer la imagen para el retoque facial.")

    if controlled_arg.startswith("controlled"):
        image, result = apply_controlled(image, level, controlled_arg)
    else:
        try:
            image, result = apply_mediapipe(image, level, model_directory)
        except Exception as error:
            shutil.copyfile(source, destination)
            print(json.dumps({
                "faces": 0,
                "treated": 0,
                "warnings": [f"MediaPipe no estuvo disponible; se omitió el retoque: {error}"],
                "backdrop": "omitted",
            }))
            return

    if result["faces"] == 0 and result["backdrop"] != "completed":
        shutil.copyfile(source, destination)
    elif not cv2.imwrite(destination, image, [cv2.IMWRITE_JPEG_QUALITY, 94]):
        raise RuntimeError("No se pudo guardar el retoque facial.")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
