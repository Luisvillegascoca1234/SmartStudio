import hashlib
import json
import os
import shutil
import sys
import time
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


def decision(applied, reason=None, regions=0):
    return {"status": "applied" if applied else "omitted", "reason": reason, "regions": regions}


def protected_skin_mask(image, candidate):
    """Keep strongly defined/dark permanent detail out of automatic skin correction."""
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    gradient = cv2.magnitude(
        cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3),
        cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3),
    )
    values = gray[candidate > 0]
    if values.size == 0:
        return candidate
    protected = (gradient > 72) | (gray < np.percentile(values, 8))
    protected = cv2.dilate(protected.astype(np.uint8), np.ones((3, 3), np.uint8)) > 0
    safe = candidate.copy()
    safe[protected] = 0
    return safe


def polish_skin(image, candidate, level):
    safe_mask = protected_skin_mask(image, candidate)
    if level <= 0 or np.count_nonzero(safe_mask) < 40:
        return image, False
    x, y, w, h = cv2.boundingRect(safe_mask)
    region = image[y:y+h, x:x+w]
    local_mask = safe_mask[y:y+h, x:x+w]
    # A visible local tone correction plus edge-preserving smoothing. High-frequency
    # detail is mixed back in so pores survive while temporary unevenness recedes.
    base = cv2.bilateralFilter(region, 9, 44, 44)
    detail = region.astype(np.float32) - cv2.GaussianBlur(region, (0, 0), 1.15).astype(np.float32)
    lab = cv2.cvtColor(base, cv2.COLOR_BGR2LAB)
    light, green_red, blue_yellow = cv2.split(lab)
    light = cv2.addWeighted(light, .88, cv2.GaussianBlur(light, (0, 0), max(2, w / 80)), .12, 2)
    green_red = cv2.addWeighted(green_red, .72, np.full_like(green_red, 128), .28, 0)
    corrected = cv2.cvtColor(cv2.merge((light, green_red, blue_yellow)), cv2.COLOR_LAB2BGR).astype(np.float32)
    corrected = np.clip(corrected + detail * .58, 0, 255)
    alpha = cv2.GaussianBlur(local_mask, (0, 0), max(1.5, w / 150)).astype(np.float32)[:, :, None] / 255
    strength = .48 if level == 1 else .68
    image[y:y+h, x:x+w] = np.clip(region * (1 - alpha * strength) + corrected * alpha * strength, 0, 255).astype(np.uint8)
    return image, True


def balance_face_light(image, face_mask):
    if np.count_nonzero(face_mask) < 40:
        return image, False
    x, y, w, h = cv2.boundingRect(face_mask)
    region = image[y:y+h, x:x+w]
    local_mask = face_mask[y:y+h, x:x+w]
    lab = cv2.cvtColor(region, cv2.COLOR_BGR2LAB)
    light = lab[:, :, 0]
    values = light[local_mask > 0]
    if values.size < 40:
        return image, False
    low, high = np.percentile(values, (12, 92))
    lifted = light.astype(np.float32)
    shadows = np.clip((low + 26 - lifted) / 26, 0, 1)
    highlights = np.clip((lifted - (high - 12)) / 22, 0, 1)
    lifted += shadows * 10 - highlights * 8
    corrected_lab = lab.copy()
    corrected_lab[:, :, 0] = np.clip(lifted, 0, 255).astype(np.uint8)
    corrected = cv2.cvtColor(corrected_lab, cv2.COLOR_LAB2BGR)
    alpha = cv2.GaussianBlur(local_mask, (0, 0), max(2, w / 100)).astype(np.float32)[:, :, None] / 255 * .62
    image[y:y+h, x:x+w] = np.clip(region * (1 - alpha) + corrected * alpha, 0, 255).astype(np.uint8)
    return image, True


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


def matte_summary(matte):
    return {
        "provider": matte["provider"],
        "model": matte["model"],
        "modelVersion": matte["model_version"],
        "modelSha256": matte.get("model_sha256"),
        "confidence": round(float(matte["confidence"]), 5),
        "boundaryConfidence": round(float(matte.get("boundary_confidence", matte["confidence"])), 5),
        "uncertainFraction": round(float(np.mean(matte["uncertain"])), 5),
        "processingRoute": matte["processing_route"],
        "sessionReused": False,
        "warmupMilliseconds": 0,
    }


def controlled_matte(person_mask, confident=True, soft=False):
    alpha = person_mask.astype(np.float32) / 255.0
    if soft:
        alpha = cv2.GaussianBlur(alpha, (0, 0), 3.0)
    person = alpha >= .86
    background = alpha <= .08
    uncertain = ~(person | background)
    return {
        "alpha": alpha,
        "person_safe": person,
        "background_safe": background,
        "uncertain": uncertain,
        "confidence": 1.0 if confident else 0.0,
        "boundary_confidence": 1.0 if confident else 0.0,
        "provider": "controlled",
        "model": "controlled-fixture",
        "model_version": "1",
        "model_sha256": None,
        "processing_route": "cpu",
    }


def apply_controlled(image, level, fixture, clean_plate_path=None):
    started = time.perf_counter()
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = image.shape[:2]
    fixture_kind = fixture.get("kind", "single")
    if fixture_kind in ("backdrop", "backdrop-soft-edge", "backdrop-uncertain-mask"):
        person_mask = np.zeros((height, width), dtype=np.uint8)
        cv2.ellipse(person_mask, (width // 2, int(height * .58)), (int(width * .18), int(height * .38)), 0, 0, 360, 255, -1)
        matte = controlled_matte(person_mask, fixture_kind != "backdrop-uncertain-mask", fixture_kind == "backdrop-soft-edge")
        if clean_plate_path:
            image, backdrop, warning, backdrop_payload = replace_with_clean_plate(image, matte, clean_plate_path)
        else:
            image, backdrop, warning, backdrop_payload = complete_uniform_backdrop(image, matte)
        done = backdrop in ("completed", "replaced")
        return image, {
            "faces": 0, "treated": 0, "warnings": [warning] if warning else [], "backdrop": backdrop,
            "operations": {
                "skin": decision(False, "No se detectaron rostros."),
                "eyes": decision(False, "No se detectaron rostros."),
                "teeth": decision(False, "No se detectaron rostros."),
                "facialLighting": decision(False, "No se detectaron rostros."),
                "backdrop": decision(done, warning, 1 if done else 0),
            },
            "stageMilliseconds": {"analysis": 0, "skin": 0, "eyesTeeth": 0, "facialLighting": 0, "backdrop": round((time.perf_counter() - started) * 1000)},
            "matte": matte_summary(matte), "_backdrop_payload": backdrop_payload,
        }
    if fixture_kind == "group":
        face_count = max(1, int(fixture.get("faceCount", 1)))
        face_width = .82 / face_count
        faces = [(int(width * (.04 + index * (.92 / face_count))), int(height * .15), int(width * face_width), int(height * .55)) for index in range(face_count)]
    else:
        faces = [(int(width * .63), int(height * .07), int(width * .31), int(height * .48))]
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    smile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")
    warnings = []
    applied = {"skin": 0, "eyes": 0, "teeth": 0, "facialLighting": 0}
    omitted = {"skin": 0, "eyes": 0, "teeth": 0, "facialLighting": 0}
    stage_times = {"analysis": 0, "skin": 0, "eyesTeeth": 0, "facialLighting": 0, "backdrop": 0}
    for x, y, w, h in faces:
        mask = ellipse_mask(image.shape, (x, y, w, h))
        skin_started = time.perf_counter()
        protected = np.zeros_like(mask)
        for center, axes in (
            ((x + int(w*.27), y + int(h*.39)), (max(2, int(w*.12)), max(2, int(h*.07)))),
            ((x + int(w*.73), y + int(h*.39)), (max(2, int(w*.12)), max(2, int(h*.07)))),
            ((x + int(w*.50), y + int(h*.76)), (max(2, int(w*.20)), max(2, int(h*.08)))),
        ):
            cv2.ellipse(protected, center, axes, 0, 0, 360, 255, -1)
        if fixture_kind not in ("uncertain", "skin-uncertain"):
            image, skin_done = polish_skin(image, cv2.bitwise_and(mask, cv2.bitwise_not(protected)), level)
            applied["skin"] += int(skin_done)
            omitted["skin"] += int(not skin_done)
        else:
            omitted["skin"] += 1
            warnings.append("La máscara de piel fue incierta en un rostro; se omitió únicamente su pulido.")
        stage_times["skin"] += round((time.perf_counter() - skin_started) * 1000)

        roi_gray = gray[y:y+h, x:x+w]
        feature_started = time.perf_counter()
        eyes = list(eye_cascade.detectMultiScale(roi_gray[:h//2], 1.1, 5, minSize=(18, 12)))
        if fixture_kind not in ("uncertain", "partial-eyes") and not eyes:
            eyes = [(int(w*.18), int(h*.32), int(w*.18), int(h*.12)), (int(w*.62), int(h*.32), int(w*.18), int(h*.12))]
        eyes = confident_eye_pair(eyes, w, h)
        if not eyes:
            omitted["eyes"] += 1
            warnings.append("No se detectaron ambos ojos con confianza en un rostro; se omitió su mejora.")
        else:
            applied["eyes"] += 1
        for ex, ey, ew, eh in eyes:
            eye = image[y+ey:y+ey+eh, x+ex:x+ex+ew]
            blue, green, red = cv2.split(eye)
            red_pixels = (red.astype(np.float32) > green * 1.35) & (red.astype(np.float32) > blue * 1.35)
            red[red_pixels] = ((green[red_pixels].astype(np.uint16) + blue[red_pixels].astype(np.uint16)) // 2).astype(np.uint8)
            corrected = cv2.merge((blue, green, red))
            image[y+ey:y+ey+eh, x+ex:x+ex+ew] = cv2.addWeighted(corrected, 1.13, cv2.GaussianBlur(corrected, (0, 0), 1), -.13, 4)

        smiles = list(smile_cascade.detectMultiScale(roi_gray[h//2:], 1.5, 20, minSize=(25, 10)))
        if fixture_kind not in ("uncertain", "no-teeth") and not smiles:
            smiles = [(int(w*.32), int(h*.25), int(w*.36), int(h*.12))]
        if fixture_kind in ("uncertain", "no-teeth"):
            smiles = []
        if not smiles:
            omitted["teeth"] += 1
            warnings.append("No se detectaron dientes con confianza en un rostro; se omitió el blanqueamiento.")
        else:
            applied["teeth"] += 1
        for sx, sy, sw, sh in smiles[:1]:
            sy += h // 2
            mouth = image[y+sy:y+sy+sh, x+sx:x+sx+sw]
            hsv = cv2.cvtColor(mouth, cv2.COLOR_BGR2HSV)
            candidate = (hsv[:, :, 1] < 110) & (hsv[:, :, 2] > 105)
            hsv[:, :, 1][candidate] = (hsv[:, :, 1][candidate] * .72).astype(np.uint8)
            hsv[:, :, 2][candidate] = np.minimum(hsv[:, :, 2][candidate].astype(np.uint16) + 12, 238).astype(np.uint8)
            image[y+sy:y+sy+sh, x+sx:x+sx+sw] = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        stage_times["eyesTeeth"] += round((time.perf_counter() - feature_started) * 1000)

        lighting_started = time.perf_counter()
        image, lighting_done = balance_face_light(image, cv2.bitwise_and(mask, cv2.bitwise_not(protected)))
        applied["facialLighting"] += int(lighting_done)
        omitted["facialLighting"] += int(not lighting_done)
        stage_times["facialLighting"] += round((time.perf_counter() - lighting_started) * 1000)

    reasons = {
        "skin": "La máscara de piel no alcanzó la confianza obligatoria.",
        "eyes": "No se detectaron ambos ojos con confianza.",
        "teeth": "No se distinguieron dientes visibles con confianza.",
        "facialLighting": "No hubo una región facial segura.",
    }
    operations = {
        name: {**decision(count > 0, reasons[name] if omitted[name] else None, count), "omittedRegions": omitted[name]}
        for name, count in applied.items()
    }
    operations["backdrop"] = decision(False, "No se detectó una interrupción confirmada del fondo.")
    matte = controlled_matte(np.zeros((height, width), dtype=np.uint8))
    return image, {
        "faces": len(faces), "treated": len(faces), "warnings": warnings, "backdrop": "unchanged",
        "operations": operations, "stageMilliseconds": stage_times, "matte": matte_summary(matte),
    }


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
    enhanced = 0
    for eye_indices, iris_indices in ((LEFT_EYE, LEFT_IRIS), (RIGHT_EYE, RIGHT_IRIS)):
        eye_mask = polygon_mask(image.shape, landmarks, eye_indices, max(2, image.shape[1] // 1000))
        if not np.any(eye_mask):
            continue
        enhanced += 1
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
    return image, enhanced == 2


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
        return "confirmed", upper_extension_mask > 0
    if np.count_nonzero(different_from_plane) >= analysis_width * analysis_height * .01:
        return "ambiguous", None
    return "none", None


def backdrop_blend_mask(image_shape, person_mask, analysis_target_mask):
    height, width = image_shape[:2]
    replacement_mask = cv2.resize(
        analysis_target_mask.astype(np.float32),
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
    )
    blend[protected_person] = 0
    return np.clip(blend, 0.0, 1.0)


def composite_completed_backdrop(image, person_mask, estimated_backdrop, analysis_target_mask):
    height, width = image.shape[:2]
    full_backdrop = cv2.resize(estimated_backdrop, (width, height), interpolation=cv2.INTER_LINEAR)
    blend = backdrop_blend_mask(image.shape, person_mask, analysis_target_mask)[:, :, None]
    return np.clip(image * (1 - blend) + full_backdrop * blend, 0, 255).astype(np.uint8)


def composite_backdrop_16_bit(image, payload):
    if payload.get("kind") == "plate":
        return composite_plate_16_bit(image, payload)
    height, width = image.shape[:2]
    clean_samples = cv2.resize(
        payload["analysis_clean_samples"].astype(np.uint8),
        (width, height),
        interpolation=cv2.INTER_NEAREST,
    ) > 0
    sample_rows, sample_columns = np.where(clean_samples)
    if len(sample_rows) < 100:
        return image
    stride = max(1, len(sample_rows) // 100000)
    sample_rows = sample_rows[::stride]
    sample_columns = sample_columns[::stride]
    positions = np.column_stack((
        sample_columns.astype(np.float32) / width,
        sample_rows.astype(np.float32) / height,
        np.ones(len(sample_rows), dtype=np.float32),
    ))
    coefficients = np.linalg.lstsq(
        positions,
        image[sample_rows, sample_columns].astype(np.float32),
        rcond=None,
    )[0]
    blend = backdrop_blend_mask(image.shape, payload["person_mask"], payload["analysis_target_mask"])
    output = image.astype(np.float32)
    normalized_columns = np.arange(width, dtype=np.float32) / width
    for start in range(0, height, 128):
        end = min(height, start + 128)
        normalized_rows = np.arange(start, end, dtype=np.float32)[:, None] / height
        plane = (
            normalized_columns[None, :, None] * coefficients[0][None, None, :]
            + normalized_rows[:, :, None] * coefficients[1][None, None, :]
            + coefficients[2][None, None, :]
        )
        alpha = blend[start:end, :, None]
        output[start:end] = output[start:end] * (1 - alpha) + plane * alpha
    return np.clip(np.round(output), 0, 65535).astype(np.uint16)


def load_compatible_plate(plate_path, image_shape):
    plate = cv2.imread(str(plate_path), cv2.IMREAD_UNCHANGED)
    if plate is None:
        return None, "La placa limpia no pudo leerse; se conservó el fondo original."
    if plate.ndim == 2:
        plate = cv2.cvtColor(plate, cv2.COLOR_GRAY2BGR)
    if plate.shape[2] > 3:
        plate = plate[:, :, :3]
    source_ratio = image_shape[1] / image_shape[0]
    plate_ratio = plate.shape[1] / plate.shape[0]
    if abs(source_ratio - plate_ratio) / max(source_ratio, .001) > .08:
        return None, "La placa limpia no tiene una orientación compatible; se conservó el fondo original."
    return plate, None


def adapt_plate(plate, image, background_safe, maximum):
    if plate.dtype == np.uint8 and maximum > 255:
        plate = plate.astype(np.float32) * (maximum / 255.0)
    else:
        plate = plate.astype(np.float32)
    plate = cv2.resize(plate, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_LANCZOS4)
    safe = background_safe & np.all(np.isfinite(plate), axis=2)
    if np.count_nonzero(safe) < image.shape[0] * image.shape[1] * .05:
        return None
    delta = np.median(image[safe].astype(np.float32), axis=0) - np.median(plate[safe], axis=0)
    return np.clip(plate + delta[None, None, :], 0, maximum)


def replace_with_clean_plate(image, matte, plate_path):
    if matte["confidence"] < .5:
        return image, "omitted", "El contorno de la persona no alcanzó la confianza obligatoria; se conservó el fondo original.", None
    plate, warning = load_compatible_plate(plate_path, image.shape)
    if warning:
        return image, "omitted", warning, None
    adapted = adapt_plate(plate, image, matte["background_safe"], 255.0)
    if adapted is None:
        return image, "omitted", "No hubo suficiente fondo seguro para adaptar la placa limpia.", None
    foreground_alpha = np.clip(matte["alpha"], 0.0, 1.0)
    foreground_alpha[matte["person_safe"]] = 1.0
    blend = (1.0 - foreground_alpha)[:, :, None]
    completed = np.clip(image.astype(np.float32) * (1 - blend) + adapted * blend, 0, 255).astype(np.uint8)
    return completed, "replaced", None, {
        "kind": "plate",
        "plate_path": str(plate_path),
        "foreground_alpha": foreground_alpha,
        "background_safe": matte["background_safe"],
    }


def composite_plate_16_bit(image, payload):
    plate, warning = load_compatible_plate(payload["plate_path"], image.shape)
    if warning:
        return image
    adapted = adapt_plate(plate, image, payload["background_safe"], 65535.0)
    if adapted is None:
        return image
    foreground_alpha = payload["foreground_alpha"][:, :, None].astype(np.float32)
    output = image.astype(np.float32) * foreground_alpha + adapted * (1.0 - foreground_alpha)
    return np.clip(np.round(output), 0, 65535).astype(np.uint16)


def complete_uniform_backdrop(image, matte):
    if matte["confidence"] < .5:
        return image, "omitted", "La máscara de la persona no tuvo suficiente confianza; se conservó el fondo original.", None
    person_mask = np.where(matte["person_safe"] | matte["uncertain"], 255, 0).astype(np.uint8)
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
        return image, "omitted", warning, None
    interruption, target_mask = backdrop_has_interruption(
        analysis_image,
        estimated_backdrop,
        analysis_background_mask,
        clean_samples,
        reference_distance,
        clean_threshold,
    )
    if interruption == "ambiguous":
        return image, "omitted", "No se distinguió con confianza el fondo uniforme de otras superficies; se conservó el original.", None
    if interruption == "none":
        return image, "unchanged", None, None
    completed = composite_completed_backdrop(image, person_mask, estimated_backdrop, target_mask)
    return completed, "completed", None, {
        "analysis_clean_samples": clean_samples,
        "analysis_target_mask": target_mask,
        "person_mask": person_mask,
    }


def segmentation_confidence(category_mask, confidence_masks):
    height, width = category_mask.shape
    analysis_width = min(320, width)
    analysis_height = max(1, round(height * analysis_width / width))
    small_category = cv2.resize(category_mask, (analysis_width, analysis_height), interpolation=cv2.INTER_NEAREST)
    resized_confidence = [
        cv2.resize(np.squeeze(mask.numpy_view()), (analysis_width, analysis_height), interpolation=cv2.INTER_AREA)
        for mask in confidence_masks
    ]
    if not resized_confidence:
        return False, 0.0
    best_confidence = np.maximum.reduce(resized_confidence)
    person = small_category > 0
    if np.count_nonzero(person) < analysis_width * analysis_height * .02:
        return False, 0.0
    score = min(
        float(np.mean(best_confidence)),
        float(np.mean(best_confidence[person])),
        max(0.0, 1.0 - float(np.mean(best_confidence < .55))),
    )
    return (
        float(np.mean(best_confidence)) >= .72
        and float(np.mean(best_confidence < .55)) <= .12
        and float(np.mean(best_confidence[person])) >= .68
    ), score


def refine_alpha(image, alpha):
    full_alpha = cv2.resize(alpha.astype(np.float32), (image.shape[1], image.shape[0]), interpolation=cv2.INTER_LINEAR)
    guide = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255.0
    if hasattr(cv2, "ximgproc") and hasattr(cv2.ximgproc, "guidedFilter"):
        refined = cv2.ximgproc.guidedFilter(guide, full_alpha, max(4, min(image.shape[:2]) // 300), 1e-3)
    else:
        refined = cv2.bilateralFilter(full_alpha, 7, .08, 5)
    return np.clip(refined, 0.0, 1.0)


def mediapipe_matte(image, category_mask, confidence_masks, model_path):
    if len(confidence_masks) > 1:
        background_probability = np.squeeze(confidence_masks[0]).astype(np.float32)
        alpha = 1.0 - background_probability
    else:
        alpha = (category_mask > 0).astype(np.float32)
    alpha = refine_alpha(image, alpha)
    rough_person = alpha >= .5
    radius = max(2, round(min(image.shape[:2]) * .0025))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    expanded = cv2.dilate(rough_person.astype(np.uint8), kernel) > 0
    contracted = cv2.erode(rough_person.astype(np.uint8), kernel) > 0
    boundary = expanded ^ contracted
    person = (alpha >= .88) & ~boundary
    background = (alpha <= .08) & ~boundary
    uncertain = ~(person | background)
    pixel_confidence = np.abs(alpha - .5) * 2.0
    boundary_confidence = float(np.mean(pixel_confidence[boundary])) if np.any(boundary) else 0.0
    person_coverage = float(np.mean(rough_person))
    uncertain_fraction = float(np.mean(uncertain))
    confident = person_coverage >= .02 and boundary_confidence >= .58 and uncertain_fraction <= .22
    return {
        "alpha": alpha,
        "person_safe": person,
        "background_safe": background,
        "uncertain": uncertain,
        "confidence": boundary_confidence if confident else 0.0,
        "boundary_confidence": boundary_confidence,
        "provider": "mediapipe",
        "model": model_path.name,
        "model_version": "1",
        "model_sha256": hashlib.sha256(model_path.read_bytes()).hexdigest(),
        "processing_route": "cpu",
    }


_MEDIAPIPE_SESSION_CACHE = {}
_BIREFNET_SESSION_CACHE = {}

BIREFNET_MODEL_NAME = "birefnet-general-lite.onnx"
BIREFNET_MODEL_VERSION = "general-lite-epoch-232"
BIREFNET_MODEL_SHA256 = "5600024376f572a557870a5eb0afb1e5961636bef4e1e22132025467d0f03333"
MEDIAPIPE_SEGMENT_MODEL_SHA256 = "c6748b1253a99067ef71f7e26ca71096cd449baefa8f101900ea23016507e0e0"


def mediapipe_sessions(model_directory):
    import mediapipe as mp

    cache_key = str(model_directory.resolve())
    if cache_key in _MEDIAPIPE_SESSION_CACHE:
        return _MEDIAPIPE_SESSION_CACHE[cache_key]
    face_model = model_directory / "face_landmarker.task"
    segment_model = model_directory / "selfie_multiclass_256x256.tflite"
    landmarker = None
    segmenter = None
    if face_model.is_file():
        face_options = mp.tasks.vision.FaceLandmarkerOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(face_model)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            num_faces=20,
            min_face_detection_confidence=.55,
            min_face_presence_confidence=.55,
            output_face_blendshapes=False,
        )
        landmarker = mp.tasks.vision.FaceLandmarker.create_from_options(face_options)
    if segment_model.is_file():
        if hashlib.sha256(segment_model.read_bytes()).hexdigest() != MEDIAPIPE_SEGMENT_MODEL_SHA256:
            raise RuntimeError("El checkpoint local de segmentación MediaPipe no coincide con la versión aprobada.")
        segment_options = mp.tasks.vision.ImageSegmenterOptions(
            base_options=mp.tasks.BaseOptions(model_asset_path=str(segment_model)),
            running_mode=mp.tasks.vision.RunningMode.IMAGE,
            output_category_mask=True,
            output_confidence_masks=True,
        )
        segmenter = mp.tasks.vision.ImageSegmenter.create_from_options(segment_options)
    sessions = (mp, landmarker, segmenter)
    _MEDIAPIPE_SESSION_CACHE[cache_key] = sessions
    return sessions


def configured_matte_provider(requested=None):
    provider = (requested or os.environ.get("SMARTSTUDIO_MATTE_PROVIDER", "mediapipe")).strip().lower()
    return "birefnet" if provider == "birefnet" else "mediapipe"


def birefnet_session(model_directory):
    import onnxruntime as ort

    model_path = model_directory / BIREFNET_MODEL_NAME
    if not model_path.is_file():
        raise RuntimeError(f"Falta el checkpoint local {BIREFNET_MODEL_NAME}; ejecuta setup:vision antes del evento.")
    digest = hashlib.sha256(model_path.read_bytes()).hexdigest()
    if digest != BIREFNET_MODEL_SHA256:
        raise RuntimeError(f"El checkpoint local {BIREFNET_MODEL_NAME} no coincide con la versión aprobada.")

    force_cpu = os.environ.get("SMARTSTUDIO_BIREFNET_FORCE_CPU") == "1"
    cache_key = (str(model_path.resolve()), force_cpu)
    if cache_key in _BIREFNET_SESSION_CACHE:
        return _BIREFNET_SESSION_CACHE[cache_key]

    available = ort.get_available_providers()
    requested = ["CPUExecutionProvider"]
    fallback = None
    if not force_cpu and "CUDAExecutionProvider" in available:
        requested = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    try:
        session = ort.InferenceSession(str(model_path), providers=requested)
    except Exception as error:
        if requested[0] != "CUDAExecutionProvider":
            raise
        session = ort.InferenceSession(str(model_path), providers=["CPUExecutionProvider"])
        fallback = f"CUDA no pudo iniciar; BiRefNet continuó en CPU: {error}"
    effective = session.get_providers()
    route = "gpu" if effective and effective[0] == "CUDAExecutionProvider" else "cpu"
    if requested[0] == "CUDAExecutionProvider" and route == "cpu" and fallback is None:
        fallback = "CUDA no pudo activarse; ONNX Runtime continuó automáticamente en CPU."
    payload = (session, route, fallback, model_path)
    _BIREFNET_SESSION_CACHE[cache_key] = payload
    return payload


def matte_from_alpha(image, alpha, provider, model, model_version, model_sha256, processing_route):
    alpha = refine_alpha(image, alpha)
    rough_person = alpha >= .5
    radius = max(2, round(min(image.shape[:2]) * .0025))
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (radius * 2 + 1, radius * 2 + 1))
    expanded = cv2.dilate(rough_person.astype(np.uint8), kernel) > 0
    contracted = cv2.erode(rough_person.astype(np.uint8), kernel) > 0
    boundary = expanded ^ contracted
    person = (alpha >= .88) & ~boundary
    background = (alpha <= .08) & ~boundary
    uncertain = ~(person | background)
    pixel_confidence = np.abs(alpha - .5) * 2.0
    boundary_confidence = float(np.mean(pixel_confidence[boundary])) if np.any(boundary) else 0.0
    person_coverage = float(np.mean(rough_person))
    uncertain_fraction = float(np.mean(uncertain))
    confident = person_coverage >= .02 and boundary_confidence >= .58 and uncertain_fraction <= .22
    return {
        "alpha": alpha,
        "person_safe": person,
        "background_safe": background,
        "uncertain": uncertain,
        "confidence": boundary_confidence if confident else 0.0,
        "boundary_confidence": boundary_confidence,
        "provider": provider,
        "model": model,
        "model_version": model_version,
        "model_sha256": model_sha256,
        "processing_route": processing_route,
    }


def birefnet_matte(image, model_directory):
    session, route, fallback, model_path = birefnet_session(model_directory)
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    resized = cv2.resize(rgb, (1024, 1024), interpolation=cv2.INTER_LANCZOS4).astype(np.float32) / 255.0
    mean = np.array([.485, .456, .406], dtype=np.float32)
    std = np.array([.229, .224, .225], dtype=np.float32)
    tensor = np.transpose((resized - mean) / std, (2, 0, 1))[None].astype(np.float32)
    prediction = session.run(None, {session.get_inputs()[0].name: tensor})[0]
    logits = np.squeeze(prediction).astype(np.float32)
    probability = 1.0 / (1.0 + np.exp(-np.clip(logits, -30, 30)))
    low, high = float(np.min(probability)), float(np.max(probability))
    alpha = (probability - low) / max(high - low, 1e-6)
    matte = matte_from_alpha(
        image, alpha, "birefnet", BIREFNET_MODEL_NAME, BIREFNET_MODEL_VERSION,
        hashlib.sha256(model_path.read_bytes()).hexdigest(), route,
    )
    return matte, fallback


def warm_models(model_directory):
    started = time.perf_counter()
    _, landmarker, segmenter = mediapipe_sessions(model_directory)
    candidate_ready = False
    candidate_route = None
    candidate_fallback = None
    if configured_matte_provider() == "birefnet":
        try:
            _, candidate_route, candidate_fallback, _ = birefnet_session(model_directory)
            candidate_ready = True
        except Exception as error:
            candidate_fallback = f"BiRefNet no pudo prepararse; se usará MediaPipe: {error}"
    return {
        "ready": landmarker is not None and segmenter is not None,
        "matteProvider": configured_matte_provider(),
        "candidateReady": candidate_ready,
        "candidateRoute": candidate_route,
        "candidateFallback": candidate_fallback,
        "warmupMilliseconds": round((time.perf_counter() - started) * 1000),
    }


def apply_mediapipe(image, level, model_directory, clean_plate_path=None, matte_provider=None):
    mp, landmarker, segmenter = mediapipe_sessions(model_directory)

    total_started = time.perf_counter()
    stage_times = {"analysis": 0, "skin": 0, "eyesTeeth": 0, "facialLighting": 0, "backdrop": 0}
    analysis_started = time.perf_counter()
    face_model = model_directory / "face_landmarker.task"
    segment_model = model_directory / "selfie_multiclass_256x256.tflite"
    rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
    face_landmarks = []
    warnings = []
    if landmarker is not None:
        face_landmarks = landmarker.detect(mp_image).face_landmarks
    else:
        warnings.append("Falta el modelo local de landmarks faciales; se omitió el retoque facial.")

    category_mask = None
    matte = None
    if segmenter is not None:
        segment_result = segmenter.segment(mp_image)
        category_mask = np.squeeze(np.array(segment_result.category_mask.numpy_view(), copy=True))
        confidence_masks = [np.squeeze(np.array(mask.numpy_view(), copy=True)) for mask in segment_result.confidence_masks]
        if configured_matte_provider(matte_provider) == "birefnet":
            try:
                matte, candidate_fallback = birefnet_matte(image, model_directory)
                if candidate_fallback:
                    warnings.append(candidate_fallback)
            except Exception as error:
                warnings.append(f"BiRefNet no estuvo disponible; se recurrió automáticamente a MediaPipe: {error}")
                matte = mediapipe_matte(image, category_mask, confidence_masks, segment_model)
        else:
            matte = mediapipe_matte(image, category_mask, confidence_masks, segment_model)
        if category_mask.shape != image.shape[:2]:
            category_mask = cv2.resize(category_mask, (image.shape[1], image.shape[0]), interpolation=cv2.INTER_NEAREST)
    else:
        warnings.append("Falta el modelo local de segmentación; se omitió el suavizado de piel.")
    stage_times["analysis"] = round((time.perf_counter() - analysis_started) * 1000)

    backdrop = "omitted"
    backdrop_started = time.perf_counter()
    if category_mask is not None:
        if clean_plate_path:
            image, backdrop, backdrop_warning, backdrop_payload = replace_with_clean_plate(image, matte, clean_plate_path)
        else:
            image, backdrop, backdrop_warning, backdrop_payload = complete_uniform_backdrop(image, matte)
        if backdrop_warning:
            warnings.append(backdrop_warning)
    else:
        warnings.append("Falta la segmentación local; se omitió el completado del fondo.")
    stage_times["backdrop"] = round((time.perf_counter() - backdrop_started) * 1000)

    if not face_landmarks:
        if face_model.is_file():
            warnings.append("No se detectaron rostros; no se aplicó retoque facial.")
        no_face = "No se detectaron rostros."
        return image, {
            "faces": 0, "treated": 0, "warnings": warnings, "backdrop": backdrop,
            "operations": {
                "skin": decision(False, no_face), "eyes": decision(False, no_face),
                "teeth": decision(False, no_face), "facialLighting": decision(False, no_face),
                "backdrop": decision(backdrop in ("completed", "replaced"), None if backdrop in ("completed", "replaced") else "El fondo no cumplió los límites de confianza.", 1 if backdrop in ("completed", "replaced") else 0),
            },
            "stageMilliseconds": stage_times,
            "matte": matte_summary(matte) if matte is not None else {
                "provider": "mediapipe", "model": segment_model.name, "modelVersion": "1", "modelSha256": None,
                "confidence": 0.0, "boundaryConfidence": 0.0, "uncertainFraction": 1.0, "processingRoute": "cpu", "sessionReused": False, "warmupMilliseconds": 0,
            }, "_backdrop_payload": backdrop_payload if category_mask is not None else None,
        }

    treated = 0
    applied = {"skin": 0, "eyes": 0, "teeth": 0, "facialLighting": 0}
    omitted = {"skin": 0, "eyes": 0, "teeth": 0, "facialLighting": 0}
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
        skin_started = time.perf_counter()
        image, skin_done = polish_skin(image, skin_mask, level) if skin_mask is not None else (image, False)
        applied["skin"] += int(skin_done)
        omitted["skin"] += int(not skin_done)
        stage_times["skin"] += round((time.perf_counter() - skin_started) * 1000)
        features_started = time.perf_counter()
        image, eyes_done = enhance_eyes(image, landmarks)
        applied["eyes"] += int(eyes_done)
        omitted["eyes"] += int(not eyes_done)
        if not eyes_done:
            warnings.append("No se detectaron ambos ojos con confianza en un rostro; se omitió su mejora.")
        image, teeth_found = whiten_teeth(image, landmarks)
        applied["teeth"] += int(teeth_found)
        omitted["teeth"] += int(not teeth_found)
        if not teeth_found:
            warnings.append("No se distinguieron dientes visibles con confianza; se omitió el blanqueamiento.")
        stage_times["eyesTeeth"] += round((time.perf_counter() - features_started) * 1000)
        lighting_started = time.perf_counter()
        image, lighting_done = balance_face_light(image, cv2.bitwise_and(face_mask, cv2.bitwise_not(eyes_and_mouth)))
        applied["facialLighting"] += int(lighting_done)
        omitted["facialLighting"] += int(not lighting_done)
        stage_times["facialLighting"] += round((time.perf_counter() - lighting_started) * 1000)
        treated += 1
    operation_reasons = {
        "skin": "Una o más regiones de piel no alcanzaron la confianza obligatoria.",
        "eyes": "Uno o más pares de ojos no alcanzaron la confianza obligatoria.",
        "teeth": "No se distinguieron dientes visibles con confianza en uno o más rostros.",
        "facialLighting": "Una o más regiones faciales no fueron seguras.",
    }
    operations = {
        name: {**decision(count > 0, operation_reasons[name] if omitted[name] else None, count), "omittedRegions": omitted[name]}
        for name, count in applied.items()
    }
    operations["backdrop"] = decision(backdrop in ("completed", "replaced"), None if backdrop in ("completed", "replaced") else "El fondo no requirió completado o no alcanzó la confianza obligatoria.", 1 if backdrop in ("completed", "replaced") else 0)
    return image, {
        "faces": len(face_landmarks), "treated": treated, "warnings": warnings, "backdrop": backdrop,
        "operations": operations, "stageMilliseconds": stage_times,
        "matte": matte_summary(matte) if matte is not None else {
            "provider": "mediapipe", "model": segment_model.name, "modelVersion": "1", "modelSha256": None,
            "confidence": 0.0, "boundaryConfidence": 0.0, "uncertainFraction": 1.0, "processingRoute": "cpu", "sessionReused": False, "warmupMilliseconds": 0,
        }, "_backdrop_payload": backdrop_payload if category_mask is not None else None,
    }


def process_image(source, destination, level, fixture, model_directory, clean_plate_path=None, matte_provider=None):
    level = min(2, max(0, int(level)))
    source = str(source)
    destination = str(destination)
    source_image = cv2.imread(source, cv2.IMREAD_UNCHANGED)
    if source_image is None:
        raise RuntimeError("No se pudo leer la imagen para el retoque facial.")
    if source_image.ndim == 2:
        source_image = cv2.cvtColor(source_image, cv2.COLOR_GRAY2BGR)
    if source_image.shape[2] > 3:
        source_image = source_image[:, :, :3]
    source_is_16_bit = source_image.dtype == np.uint16
    image = np.round(source_image.astype(np.float32) / 257).astype(np.uint8) if source_is_16_bit else source_image

    if fixture is not None:
        image, result = apply_controlled(image, level, fixture, clean_plate_path)
    else:
        try:
            image, result = apply_mediapipe(image, level, model_directory, clean_plate_path, matte_provider)
        except Exception as error:
            shutil.copyfile(source, destination)
            omitted_reason = f"MediaPipe no estuvo disponible; se omitió el retoque: {error}"
            return {
                "faces": 0,
                "treated": 0,
                "warnings": [omitted_reason],
                "backdrop": "omitted",
                "operations": {
                    "skin": decision(False, omitted_reason), "eyes": decision(False, omitted_reason),
                    "teeth": decision(False, omitted_reason), "facialLighting": decision(False, omitted_reason),
                    "backdrop": decision(False, omitted_reason),
                },
                "stageMilliseconds": {"analysis": 0, "skin": 0, "eyesTeeth": 0, "facialLighting": 0, "backdrop": 0},
                "matte": {
                    "provider": "mediapipe", "model": "unavailable", "modelVersion": "1", "modelSha256": None,
                    "confidence": 0.0, "boundaryConfidence": 0.0, "uncertainFraction": 1.0, "processingRoute": "cpu", "sessionReused": False, "warmupMilliseconds": 0,
                },
            }

    backdrop_payload = result.pop("_backdrop_payload", None)
    if result["faces"] == 0 and result["backdrop"] not in ("completed", "replaced"):
        shutil.copyfile(source, destination)
    else:
        if source_is_16_bit:
            source_preview = np.round(source_image.astype(np.float32) / 257).astype(np.int32)
            correction = image.astype(np.int32) - source_preview
            output = np.clip(source_image.astype(np.int32) + correction * 257, 0, 65535).astype(np.uint16)
            if backdrop_payload is not None:
                output = composite_backdrop_16_bit(output, backdrop_payload)
        elif Path(destination).suffix.lower() in (".tif", ".tiff"):
            output = image.astype(np.uint16) * 257
        else:
            output = image
        parameters = [cv2.IMWRITE_TIFF_COMPRESSION, 5] if Path(destination).suffix.lower() in (".tif", ".tiff") else [cv2.IMWRITE_JPEG_QUALITY, 94]
        if not cv2.imwrite(destination, output, parameters):
            raise RuntimeError("No se pudo guardar el retoque facial.")
    return result


def main():
    source, destination = sys.argv[1], sys.argv[2]
    level = int(sys.argv[3])
    fixture = json.loads(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] != "-" else None
    default_models = Path(os.environ.get("SMARTSTUDIO_MODEL_DIR", Path.cwd() / ".smartstudio-data" / "models"))
    model_directory = Path(sys.argv[5]) if len(sys.argv) > 5 else default_models
    clean_plate_path = Path(sys.argv[6]) if len(sys.argv) > 6 and sys.argv[6] != "-" else None
    matte_provider = sys.argv[7] if len(sys.argv) > 7 and sys.argv[7] != "-" else None
    print(json.dumps(process_image(source, destination, level, fixture, model_directory, clean_plate_path, matte_provider)))


if __name__ == "__main__":
    main()
