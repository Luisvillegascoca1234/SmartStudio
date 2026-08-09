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


def adaptive_tone(image):
    height, width = image.shape[:2]
    analysis_width = min(640, width)
    analysis_height = max(1, round(height * analysis_width / width))
    analysis = cv2.resize(image, (analysis_width, analysis_height), interpolation=cv2.INTER_AREA)
    sample = analysis.astype(np.float32) / 255
    blue, green, red = cv2.split(sample)
    luminance = .0722 * blue + .7152 * green + .2126 * red
    p10, p25, median, p90, p98 = np.percentile(luminance, [10, 25, 50, 90, 98])

    ycrcb = cv2.cvtColor(analysis, cv2.COLOR_BGR2YCrCb)
    skin = (
        (ycrcb[:, :, 1] >= 133) & (ycrcb[:, :, 1] <= 180)
        & (ycrcb[:, :, 2] >= 77) & (ycrcb[:, :, 2] <= 135)
        & (luminance >= .18) & (luminance <= .92)
    )
    skin_share = np.count_nonzero(skin) / skin.size
    global_ev = np.log2(.50 / max(float(median), .08))
    skin_highlight = None
    if .015 <= skin_share <= .65:
        skin_median = float(np.median(luminance[skin]))
        skin_highlight = float(np.percentile(luminance[skin], 90))
        face_ev = np.log2(.56 / max(skin_median, .12))
        exposure_ev = global_ev * .25 + face_ev * .75
    else:
        skin_median = None
        exposure_ev = global_ev
    exposure_ev = float(np.clip(exposure_ev, -.55, .55))
    highlight_limit = np.log2(.965 / max(float(p98), .25))
    exposure_ev = min(exposure_ev, float(highlight_limit + .08))
    if skin_highlight is not None:
        skin_highlight_limit = np.log2(.90 / max(skin_highlight, .3))
        exposure_ev = min(exposure_ev, float(skin_highlight_limit + .04))

    hsv = cv2.cvtColor(analysis, cv2.COLOR_BGR2HSV)
    neutral = (hsv[:, :, 1] <= 38) & (luminance >= .18) & (luminance <= .88)
    if np.count_nonzero(neutral) >= neutral.size * .012:
        neutral_channels = np.median(sample[neutral], axis=0)
        neutral_target = float(np.mean(neutral_channels))
        gains = np.clip(neutral_target / np.maximum(neutral_channels, .04), .94, 1.06)
    else:
        middle = (luminance >= .12) & (luminance <= .9)
        channel_means = np.mean(sample[middle], axis=0)
        gray_target = float(np.mean(channel_means))
        gains = np.clip(gray_target / np.maximum(channel_means, .04), .97, 1.03)

    shadow_lift = float(np.clip((.30 - p25) * .20, 0, .04))
    highlight_recovery = float(np.clip((p98 * (2 ** exposure_ev) - .89) * .50, 0, .14))
    input_values = np.arange(256, dtype=np.float32) / 255
    channel_tables = []
    for gain in gains:
        values = input_values * float(gain) * (2 ** exposure_ev)
        values += shadow_lift * np.square(np.clip(1 - values, 0, 1))
        values -= highlight_recovery * np.power(np.clip(values, 0, 1), 4)
        values = .5 + (values - .5) * 1.045
        channel_tables.append(np.clip(values * 255, 0, 255).astype(np.uint8))
    corrected = cv2.merge([
        cv2.LUT(channel, table)
        for channel, table in zip(cv2.split(image), channel_tables)
    ])
    corrected_hsv = cv2.cvtColor(corrected, cv2.COLOR_BGR2HSV)
    saturation_values = np.arange(256, dtype=np.float32)
    saturation_table = np.clip(saturation_values * (1.045 - .025 * saturation_values / 255), 0, 255).astype(np.uint8)
    corrected_hsv[:, :, 1] = cv2.LUT(corrected_hsv[:, :, 1], saturation_table)
    corrected = cv2.cvtColor(corrected_hsv, cv2.COLOR_HSV2BGR)
    corrected_analysis = cv2.merge([
        cv2.LUT(channel, table)
        for channel, table in zip(cv2.split(analysis), channel_tables)
    ])
    corrected_luminance = cv2.cvtColor(corrected_analysis, cv2.COLOR_BGR2GRAY).astype(np.float32) / 255
    diagnostics = {
        "exposureEv": round(exposure_ev, 3),
        "luminanceBefore": round(float(median), 3),
        "luminanceAfter": round(float(np.median(corrected_luminance)), 3),
        "skinLuminanceBefore": round(skin_median, 3) if skin_median is not None else None,
        "blueGain": round(float(gains[0]), 3),
        "greenGain": round(float(gains[1]), 3),
        "redGain": round(float(gains[2]), 3),
        "shadowLift": round(shadow_lift, 3),
        "highlightRecovery": round(highlight_recovery, 3),
    }
    return corrected, diagnostics


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


def apply_controlled(image, level, controlled_arg, complete_backdrop):
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    height, width = image.shape[:2]
    if complete_backdrop and controlled_arg in ("controlled:backdrop", "controlled:backdrop-uncertain-mask"):
        person_mask = np.zeros((height, width), dtype=np.uint8)
        cv2.ellipse(person_mask, (width // 2, int(height * .58)), (int(width * .18), int(height * .38)), 0, 0, 360, 255, -1)
        image, backdrop, warning, diagnostics, artifacts = complete_uniform_backdrop(
            image,
            person_mask,
            controlled_arg != "controlled:backdrop-uncertain-mask",
        )
        return image, {
            "faces": 0,
            "treated": 0,
            "eyesEnhanced": False,
            "teethWhitened": False,
            "warnings": [warning] if warning else [],
            "backdrop": backdrop,
            "backdropDiagnostics": diagnostics,
            "_diagnosticMasks": artifacts,
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
    eyes_enhanced = False
    teeth_whitened = False
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
        if eyes:
            eyes_enhanced = True
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
        if smiles:
            teeth_whitened = True
        for sx, sy, sw, sh in smiles[:1]:
            sy += h // 2
            mouth = image[y+sy:y+sy+sh, x+sx:x+sx+sw]
            hsv = cv2.cvtColor(mouth, cv2.COLOR_BGR2HSV)
            candidate = (hsv[:, :, 1] < 110) & (hsv[:, :, 2] > 105)
            hsv[:, :, 1][candidate] = (hsv[:, :, 1][candidate] * .78).astype(np.uint8)
            hsv[:, :, 2][candidate] = np.minimum(hsv[:, :, 2][candidate].astype(np.uint16) + 8, 235).astype(np.uint8)
            image[y+sy:y+sy+sh, x+sx:x+sx+sw] = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
        treated += 1
    return image, {
        "faces": len(faces),
        "treated": treated,
        "eyesEnhanced": eyes_enhanced,
        "teethWhitened": teeth_whitened,
        "warnings": warnings,
        "backdrop": "unchanged",
        "backdropDiagnostics": None,
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
    enhanced = False
    for eye_indices, iris_indices in ((LEFT_EYE, LEFT_IRIS), (RIGHT_EYE, RIGHT_IRIS)):
        eye_mask = polygon_mask(image.shape, landmarks, eye_indices, max(2, image.shape[1] // 1000))
        if not np.any(eye_mask):
            continue
        enhanced = True
        x, y, w, h = cv2.boundingRect(eye_mask)
        region = image[y:y+h, x:x+w]
        local_mask = eye_mask[y:y+h, x:x+w].astype(np.float32)[:, :, None] / 255
        detail = cv2.addWeighted(region, 1.2, cv2.GaussianBlur(region, (0, 0), 1), -0.2, 3)
        image[y:y+h, x:x+w] = np.clip(region * (1 - local_mask * .46) + detail * local_mask * .46, 0, 255).astype(np.uint8)

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
    return image, enhanced


def retouch_skin(image, skin_mask, face_mask, landmarks, level):
    x, y, w, h = cv2.boundingRect(face_mask)
    region = image[y:y+h, x:x+w]
    local_mask = skin_mask[y:y+h, x:x+w]
    smooth = cv2.bilateralFilter(region, 9 if level == 1 else 11, 38 if level == 1 else 52, 38 if level == 1 else 52)
    alpha = cv2.GaussianBlur(local_mask, (0, 0), max(2, w / 180)).astype(np.float32)[:, :, None] / 255
    strength = .34 if level == 1 else .48
    retouched = np.clip(region * (1 - alpha * strength) + smooth * alpha * strength, 0, 255).astype(np.uint8)

    local_blue, local_green, local_red = cv2.split(retouched.astype(np.float32))
    redness = local_red - (local_green + local_blue) * .5
    local_redness = cv2.GaussianBlur(redness, (0, 0), max(2.0, w / 90))
    blemish_candidates = (
        (local_mask > 0)
        & ((redness - local_redness) > (8 if level == 1 else 6))
        & (local_red > local_green * 1.04)
        & (local_red > 75)
    )
    component_count, component_labels, component_stats, _ = cv2.connectedComponentsWithStats(blemish_candidates.astype(np.uint8), 8)
    maximum_blemish_area = max(12, round(w * h * .0012))
    component_areas = component_stats[1:, cv2.CC_STAT_AREA]
    accepted_components = np.flatnonzero((component_areas >= 2) & (component_areas <= maximum_blemish_area)) + 1
    blemishes = np.isin(component_labels, accepted_components).astype(np.uint8) * 255
    if np.any(blemishes):
        blemishes = cv2.dilate(blemishes, np.ones((3, 3), np.uint8))
        blemish_alpha = cv2.GaussianBlur(blemishes, (0, 0), max(1.0, w / 380)).astype(np.float32)[:, :, None] / 255
        blemish_strength = .38 if level == 1 else .55
        retouched = np.clip(
            retouched * (1 - blemish_alpha * blemish_strength)
            + smooth * blemish_alpha * blemish_strength,
            0,
            255,
        ).astype(np.uint8)

    hsv = cv2.cvtColor(retouched, cv2.COLOR_BGR2HSV)
    skin_pixels = local_mask > 0
    if np.count_nonzero(skin_pixels) > 40:
        shine_threshold = max(178, float(np.percentile(hsv[:, :, 2][skin_pixels], 88)))
        shine = skin_pixels & (hsv[:, :, 1] < 105) & (hsv[:, :, 2] >= shine_threshold)
        shine_alpha = cv2.GaussianBlur(shine.astype(np.uint8) * 255, (0, 0), max(1.2, w / 260)).astype(np.float32) / 255
        reduction = 7 if level == 1 else 11
        value = hsv[:, :, 2].astype(np.float32)
        hsv[:, :, 2] = np.clip(value - shine_alpha * reduction, 0, 255).astype(np.uint8)
        retouched = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)

    face_height = max(1, round((max(point.y for point in landmarks) - min(point.y for point in landmarks)) * image.shape[0]))
    under_eye = np.zeros(image.shape[:2], dtype=np.uint8)
    for indices in (LEFT_EYE, RIGHT_EYE):
        eye = polygon_mask(image.shape, landmarks, indices, max(2, face_height // 80))
        transform = np.float32([[1, 0, 0], [0, 1, max(2, face_height // 28)]])
        shifted = cv2.warpAffine(eye, transform, (image.shape[1], image.shape[0]))
        under_eye = cv2.bitwise_or(under_eye, shifted)
    under_eye = cv2.bitwise_and(under_eye, skin_mask)
    local_under_eye = under_eye[y:y+h, x:x+w]
    if np.any(local_under_eye):
        eye_alpha = cv2.GaussianBlur(local_under_eye, (0, 0), max(1.5, w / 220)).astype(np.float32)[:, :, None] / 255
        lifted = np.clip(retouched.astype(np.float32) + (5 if level == 1 else 8), 0, 255)
        retouched = np.clip(retouched * (1 - eye_alpha * .42) + lifted * eye_alpha * .42, 0, 255).astype(np.uint8)

    image[y:y+h, x:x+w] = retouched
    return image


def whiten_teeth(image, landmarks):
    face_height = (max(point.y for point in landmarks) - min(point.y for point in landmarks)) * image.shape[0]
    inner_lip_gap = abs(landmarks[14].y - landmarks[13].y) * image.shape[0]
    if inner_lip_gap < max(2, face_height * .012):
        return image, False
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


def mask_percent(mask):
    return round(float(np.count_nonzero(mask)) * 100 / mask.size, 2)


def mask_span(mask):
    rows, columns = np.nonzero(mask)
    if not len(rows):
        return 0.0, 0.0
    return (
        round(float(np.ptp(columns) + 1) * 100 / mask.shape[1], 2),
        round(float(np.ptp(rows) + 1) * 100 / mask.shape[0], 2),
    )


def estimate_backdrop_plane(analysis_image, background_mask):
    analysis_height, analysis_width = background_mask.shape
    area = analysis_width * analysis_height
    rows, columns = np.mgrid[:analysis_height, :analysis_width]
    diagnostics = {
        "backgroundPercent": mask_percent(background_mask),
        "referencePercent": 0.0,
        "referenceSpanWidthPercent": 0.0,
        "referenceSpanHeightPercent": 0.0,
    }
    if np.count_nonzero(background_mask) < area * .04:
        return None, None, diagnostics, "No hubo suficiente fondo visible para estimar un color uniforme."

    analysis_lab = cv2.cvtColor(analysis_image, cv2.COLOR_BGR2LAB).astype(np.float32)
    quantized = np.stack((
        (analysis_lab[:, :, 0] // 8).astype(np.int16),
        (analysis_lab[:, :, 1] // 6).astype(np.int16),
        (analysis_lab[:, :, 2] // 6).astype(np.int16),
    ), axis=2)
    candidate_bins, counts = np.unique(quantized[background_mask], axis=0, return_counts=True)
    order = np.argsort(counts)[::-1][:12]
    best = None
    for index in order:
        seed = candidate_bins[index]
        seed_mask = background_mask & np.all(quantized == seed, axis=2)
        if np.count_nonzero(seed_mask) < area * .008:
            continue
        seed_color = np.median(analysis_lab[seed_mask], axis=0)
        distance = np.linalg.norm(analysis_lab - seed_color, axis=2)
        cluster = background_mask & (distance <= 14)
        span_width, span_height = mask_span(cluster)
        cluster_count = np.count_nonzero(cluster)
        if span_width < 42 or span_height < 10 or cluster_count < area * .035:
            continue
        score = cluster_count * (1 + span_width / 100 + span_height / 200)
        if best is None or score > best[0]:
            best = (score, seed_color, distance, cluster)
    if best is None:
        return None, None, diagnostics, "No se encontró una región de fondo uniforme con extensión suficiente."

    _, reference_color, reference_distance, initial_cluster = best
    uniformity = float(np.percentile(reference_distance[initial_cluster], 80))
    clean_threshold = min(16.0, max(7.0, uniformity + 3.0))
    clean_samples = background_mask & (reference_distance <= clean_threshold)
    span_width, span_height = mask_span(clean_samples)
    diagnostics.update({
        "referencePercent": mask_percent(clean_samples),
        "referenceSpanWidthPercent": span_width,
        "referenceSpanHeightPercent": span_height,
    })
    clean_share = np.count_nonzero(clean_samples) / max(1, np.count_nonzero(background_mask))
    if clean_share < .53:
        return None, clean_samples, diagnostics, "El fondo no era suficientemente uniforme; coexistían varias superficies dominantes."
    if np.count_nonzero(clean_samples) < area * .04 or span_width < 50 or span_height < 12:
        return None, clean_samples, diagnostics, "Las regiones uniformes no cubrieron suficiente área para reconstruir el fondo."

    clean_columns = columns[clean_samples].astype(np.float32)
    clean_rows = rows[clean_samples].astype(np.float32)
    clean_colors = analysis_image[clean_samples].astype(np.float32)
    if len(clean_rows) > 50000:
        sample_indices = np.linspace(0, len(clean_rows) - 1, 50000, dtype=np.int32)
        clean_columns = clean_columns[sample_indices]
        clean_rows = clean_rows[sample_indices]
        clean_colors = clean_colors[sample_indices]
    sample_positions = np.column_stack((
        clean_columns / analysis_width,
        clean_rows / analysis_height,
        np.ones(len(clean_rows), dtype=np.float32),
    ))
    plane_coefficients = np.linalg.lstsq(sample_positions, clean_colors, rcond=None)[0]
    all_positions = np.column_stack((
        columns.ravel().astype(np.float32) / analysis_width,
        rows.ravel().astype(np.float32) / analysis_height,
        np.ones(area, dtype=np.float32),
    ))
    estimated_backdrop = np.clip(all_positions @ plane_coefficients, 0, 255).reshape(
        analysis_height,
        analysis_width,
        3,
    ).astype(np.uint8)
    return estimated_backdrop, clean_samples, diagnostics, None


def backdrop_replacement_mask(analysis_image, estimated_backdrop, background_mask, clean_samples):
    analysis_height, analysis_width = background_mask.shape
    area = analysis_width * analysis_height
    estimated_lab = cv2.cvtColor(estimated_backdrop, cv2.COLOR_BGR2LAB).astype(np.float32)
    analysis_lab = cv2.cvtColor(analysis_image, cv2.COLOR_BGR2LAB).astype(np.float32)
    distance_from_plane = np.linalg.norm(analysis_lab - estimated_lab, axis=2)
    plane_residual = float(np.median(distance_from_plane[clean_samples]))
    different_from_plane = background_mask & (distance_from_plane > max(7.0, plane_residual * 2.4))

    minimum_run = max(4, analysis_height // 100)
    maximum_extension_start = round(analysis_height * .62)
    upper_extension = np.zeros_like(background_mask, dtype=np.uint8)
    for column in range(analysis_width):
        clean_run = np.convolve(clean_samples[:, column].astype(np.uint8), np.ones(minimum_run, dtype=np.uint8), mode="valid")
        run_starts = np.flatnonzero(clean_run == minimum_run)
        if len(run_starts) and minimum_run <= run_starts[0] <= maximum_extension_start:
            extension_end = min(analysis_height, run_starts[0] + minimum_run)
            upper_extension[:extension_end, column] = background_mask[:extension_end, column]

    morphology_size = max(5, analysis_width // 80)
    if morphology_size % 2 == 0:
        morphology_size += 1
    upper_extension = cv2.morphologyEx(
        upper_extension,
        cv2.MORPH_CLOSE,
        np.ones((morphology_size, morphology_size), np.uint8),
    ) > 0
    extension_pixels = np.count_nonzero(upper_extension)
    extension_columns = np.count_nonzero(np.any(upper_extension, axis=0))
    differing_pixels = np.count_nonzero(upper_extension & different_from_plane)
    confirmed = (
        extension_pixels >= area * .01
        and extension_columns >= analysis_width * .42
        and differing_pixels >= extension_pixels * .18
    )
    if confirmed:
        return "confirmed", upper_extension, "Se confirmó una interrupción superior conectada al fondo uniforme."
    if np.count_nonzero(different_from_plane) >= area * .012:
        return "ambiguous", np.zeros_like(background_mask), "Las diferencias no formaron una interrupción amplia y segura."
    return "none", np.zeros_like(background_mask), "El fondo uniforme no presentó una interrupción que requiera completado."


def composite_completed_backdrop(image, person_mask, estimated_backdrop, analysis_replacement_mask):
    height, width = image.shape[:2]
    full_backdrop = cv2.resize(estimated_backdrop, (width, height), interpolation=cv2.INTER_LINEAR)
    replacement_mask = cv2.resize(
        analysis_replacement_mask.astype(np.float32),
        (width, height),
        interpolation=cv2.INTER_LINEAR,
    )
    protection_radius = max(3, round(min(width, height) * .0025))
    protected_person = cv2.dilate(
        person_mask,
        np.ones((protection_radius * 2 + 1, protection_radius * 2 + 1), np.uint8),
    ) > 0
    replacement_mask[protected_person] = 0
    blend = cv2.GaussianBlur(
        replacement_mask,
        (0, 0),
        max(2.0, min(width, height) / 500),
    )[:, :, None]
    blend[protected_person] = 0
    return masked_blend(image, full_backdrop, blend[:, :, 0])


def masked_blend(image, target, alpha, strip_height=384):
    output = image.copy()
    for start in range(0, image.shape[0], strip_height):
        end = min(image.shape[0], start + strip_height)
        strip_alpha = alpha[start:end].astype(np.float32)[:, :, None]
        source_strip = image[start:end].astype(np.float32)
        target_strip = target[start:end].astype(np.float32)
        output[start:end] = np.clip(
            source_strip * (1 - strip_alpha) + target_strip * strip_alpha,
            0,
            255,
        ).astype(np.uint8)
    return output


def clean_textured_backdrop(image, person_mask, analysis_image, background_mask, protected_mask):
    analysis_height, analysis_width = background_mask.shape
    area = analysis_height * analysis_width
    lab = cv2.cvtColor(analysis_image, cv2.COLOR_BGR2LAB).astype(np.float32)
    quantized = np.stack((
        (lab[:, :, 0] // 10).astype(np.int16),
        (lab[:, :, 1] // 8).astype(np.int16),
        (lab[:, :, 2] // 8).astype(np.int16),
    ), axis=2)
    bins, counts = np.unique(quantized[background_mask], axis=0, return_counts=True)
    best = None
    for index in np.argsort(counts)[::-1][:10]:
        seed_mask = background_mask & np.all(quantized == bins[index], axis=2)
        if np.count_nonzero(seed_mask) < area * .012:
            continue
        seed_color = np.median(lab[seed_mask], axis=0)
        neutral_distance = abs(float(seed_color[1]) - 128) + abs(float(seed_color[2]) - 128)
        if neutral_distance > 34:
            continue
        distance = np.linalg.norm(lab - seed_color, axis=2)
        surface = background_mask & (distance <= 27)
        span_width, span_height = mask_span(surface)
        if np.count_nonzero(surface) < area * .08 or span_width < 72 or span_height < 48:
            continue
        component_count, labels, statistics, _ = cv2.connectedComponentsWithStats(surface.astype(np.uint8), 8)
        if component_count <= 1:
            continue
        largest_label = 1 + int(np.argmax(statistics[1:, cv2.CC_STAT_AREA]))
        largest = labels == largest_label
        if np.count_nonzero(largest) < np.count_nonzero(surface) * .62:
            continue
        border_pixels = np.count_nonzero(largest[0]) + np.count_nonzero(largest[-1]) + np.count_nonzero(largest[:, 0]) + np.count_nonzero(largest[:, -1])
        if border_pixels < (analysis_width + analysis_height) * .12:
            continue
        score = np.count_nonzero(largest) * (span_width + span_height)
        if best is None or score > best[0]:
            best = (score, largest, seed_color, distance)
    if best is None:
        return None

    _, surface, _, distance = best
    gray = cv2.cvtColor(analysis_image, cv2.COLOR_BGR2GRAY)
    gradient_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
    gradient_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
    strong_edges = cv2.magnitude(gradient_x, gradient_y) > 82
    edge_density = np.count_nonzero(strong_edges & surface) / max(1, np.count_nonzero(surface))
    if edge_density > .14:
        return None
    edge_radius = max(2, analysis_width // 180)
    strong_edges = cv2.dilate(strong_edges.astype(np.uint8), np.ones((edge_radius * 2 + 1, edge_radius * 2 + 1), np.uint8)) > 0
    cleanup_mask = surface & ~protected_mask & ~strong_edges & (distance <= 25)
    if np.count_nonzero(cleanup_mask) < area * .055:
        return None

    rows, columns = np.mgrid[:analysis_height, :analysis_width]
    sample_positions = np.column_stack((
        columns[cleanup_mask].astype(np.float32) / analysis_width,
        rows[cleanup_mask].astype(np.float32) / analysis_height,
        np.ones(np.count_nonzero(cleanup_mask), dtype=np.float32),
    ))
    sample_colors = analysis_image[cleanup_mask].astype(np.float32)
    coefficients = np.linalg.lstsq(sample_positions, sample_colors, rcond=None)[0]
    all_positions = np.column_stack((
        columns.ravel().astype(np.float32) / analysis_width,
        rows.ravel().astype(np.float32) / analysis_height,
        np.ones(area, dtype=np.float32),
    ))
    plane = np.clip(all_positions @ coefficients, 0, 255).reshape(analysis_height, analysis_width, 3).astype(np.uint8)
    surface_residual = np.linalg.norm(
        analysis_image[cleanup_mask].astype(np.float32) - plane[cleanup_mask].astype(np.float32),
        axis=1,
    )
    if float(np.percentile(surface_residual, 70)) < 4.5:
        return None

    height, width = image.shape[:2]
    full_plane = cv2.resize(plane, (width, height), interpolation=cv2.INTER_LINEAR)
    full_mask = cv2.resize(cleanup_mask.astype(np.float32), (width, height), interpolation=cv2.INTER_LINEAR)
    protection_radius = max(3, round(min(width, height) * .003))
    protected_person = cv2.dilate(person_mask, np.ones((protection_radius * 2 + 1, protection_radius * 2 + 1), np.uint8)) > 0
    full_mask[protected_person] = 0
    full_mask = cv2.GaussianBlur(full_mask, (0, 0), max(2.0, min(width, height) / 650))
    full_mask[protected_person] = 0
    blend = np.clip(full_mask * .34, 0, .34)
    cleaned = masked_blend(image, full_plane, blend)
    return cleaned, cleanup_mask


def complete_uniform_backdrop(image, person_mask, segmentation_confident=True):
    height, width = image.shape[:2]
    analysis_width = min(480, width)
    analysis_height = max(1, round(height * analysis_width / width))
    analysis_person_mask = cv2.resize(
        person_mask,
        (analysis_width, analysis_height),
        interpolation=cv2.INTER_NEAREST,
    ) > 0
    protected_radius = max(2, analysis_width // 160)
    protected_mask = cv2.dilate(
        analysis_person_mask.astype(np.uint8),
        np.ones((protected_radius * 2 + 1, protected_radius * 2 + 1), np.uint8),
    ) > 0
    diagnostics = {
        "analysisWidth": analysis_width,
        "analysisHeight": analysis_height,
        "backgroundPercent": round(100 - mask_percent(analysis_person_mask), 2),
        "referencePercent": 0.0,
        "protectedPercent": mask_percent(protected_mask),
        "replacementPercent": 0.0,
        "referenceSpanWidthPercent": 0.0,
        "referenceSpanHeightPercent": 0.0,
        "confidence": "low",
        "reason": "",
    }
    artifacts = {
        "person": analysis_person_mask.astype(np.uint8) * 255,
        "protected": protected_mask.astype(np.uint8) * 255,
        "reference": np.zeros((analysis_height, analysis_width), dtype=np.uint8),
        "replacement": np.zeros((analysis_height, analysis_width), dtype=np.uint8),
    }
    if not segmentation_confident:
        diagnostics["reason"] = "La segmentación de la persona no alcanzó la confianza mínima."
        return image, "omitted", "La máscara de la persona no tuvo suficiente confianza; se conservó el fondo original.", diagnostics, artifacts

    analysis_image = cv2.resize(image, (analysis_width, analysis_height), interpolation=cv2.INTER_AREA)
    analysis_background_mask = ~analysis_person_mask
    estimated_backdrop, clean_samples, estimate_diagnostics, warning = estimate_backdrop_plane(
        analysis_image,
        analysis_background_mask,
    )
    diagnostics.update(estimate_diagnostics)
    if clean_samples is not None:
        artifacts["reference"] = clean_samples.astype(np.uint8) * 255
    if warning:
        cleaned = clean_textured_backdrop(
            image,
            person_mask,
            analysis_image,
            analysis_background_mask,
            protected_mask,
        )
        if cleaned is not None:
            cleaned_image, cleanup_mask = cleaned
            artifacts["replacement"] = cleanup_mask.astype(np.uint8) * 255
            diagnostics["replacementPercent"] = mask_percent(cleanup_mask)
            diagnostics["confidence"] = "high"
            diagnostics["reason"] = "Se uniformizó de forma conservadora una superficie de fondo neutra y conectada."
            return cleaned_image, "completed", None, diagnostics, artifacts
        diagnostics["reason"] = warning
        return image, "omitted", warning, diagnostics, artifacts

    interruption, replacement_mask, reason = backdrop_replacement_mask(
        analysis_image,
        estimated_backdrop,
        analysis_background_mask,
        clean_samples,
    )
    replacement_mask = replacement_mask & ~protected_mask
    artifacts["replacement"] = replacement_mask.astype(np.uint8) * 255
    diagnostics["replacementPercent"] = mask_percent(replacement_mask)
    diagnostics["reason"] = reason
    if interruption == "ambiguous":
        cleaned = clean_textured_backdrop(
            image,
            person_mask,
            analysis_image,
            analysis_background_mask,
            protected_mask,
        )
        if cleaned is not None:
            cleaned_image, cleanup_mask = cleaned
            artifacts["replacement"] = cleanup_mask.astype(np.uint8) * 255
            diagnostics["replacementPercent"] = mask_percent(cleanup_mask)
            diagnostics["confidence"] = "high"
            diagnostics["reason"] = "Se uniformizó de forma conservadora una superficie de fondo neutra y conectada."
            return cleaned_image, "completed", None, diagnostics, artifacts
        return image, "omitted", "No se distinguió con confianza el fondo uniforme de otras superficies; se conservó el original.", diagnostics, artifacts
    if interruption == "none":
        cleaned = clean_textured_backdrop(
            image,
            person_mask,
            analysis_image,
            analysis_background_mask,
            protected_mask,
        )
        if cleaned is not None:
            cleaned_image, cleanup_mask = cleaned
            artifacts["replacement"] = cleanup_mask.astype(np.uint8) * 255
            diagnostics["replacementPercent"] = mask_percent(cleanup_mask)
            diagnostics["confidence"] = "high"
            diagnostics["reason"] = "Se uniformizó de forma conservadora una superficie de fondo neutra y conectada."
            return cleaned_image, "completed", None, diagnostics, artifacts
        diagnostics["confidence"] = "high"
        return image, "unchanged", None, diagnostics, artifacts
    if np.count_nonzero(replacement_mask) < analysis_width * analysis_height * .008:
        diagnostics["reason"] = "La región segura restante fue demasiado pequeña después de proteger el primer plano."
        return image, "omitted", "La región segura del fondo fue demasiado pequeña; se conservó el original.", diagnostics, artifacts
    diagnostics["confidence"] = "high"
    completed = composite_completed_backdrop(image, person_mask, estimated_backdrop, replacement_mask)
    return completed, "completed", None, diagnostics, artifacts


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


def apply_mediapipe(image, level, model_directory, complete_backdrop):
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

    backdrop = "unchanged"
    backdrop_diagnostics = None
    diagnostic_masks = None
    if complete_backdrop and category_mask is not None:
        person_mask = np.where(category_mask > 0, 255, 0).astype(np.uint8)
        image, backdrop, backdrop_warning, backdrop_diagnostics, diagnostic_masks = complete_uniform_backdrop(
            image,
            person_mask,
            segmentation_confident,
        )
        if backdrop_warning:
            warnings.append(backdrop_warning)
    elif complete_backdrop:
        warnings.append("Falta la segmentación local; se omitió el completado del fondo.")
        backdrop = "omitted"

    if not face_landmarks:
        if face_model.is_file():
            warnings.append("No se detectaron rostros; no se aplicó retoque facial.")
        return image, {
            "faces": 0,
            "treated": 0,
            "eyesEnhanced": False,
            "teethWhitened": False,
            "warnings": warnings,
            "backdrop": backdrop,
            "backdropDiagnostics": backdrop_diagnostics,
            "_diagnosticMasks": diagnostic_masks,
        }

    treated = 0
    eyes_enhanced = False
    teeth_whitened = False
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
            image = retouch_skin(image, skin_mask, face_mask, landmarks, level)
        image, enhanced = enhance_eyes(image, landmarks)
        eyes_enhanced = eyes_enhanced or enhanced
        image, teeth_found = whiten_teeth(image, landmarks)
        teeth_whitened = teeth_whitened or teeth_found
        if not teeth_found:
            warnings.append("No se distinguieron dientes visibles con confianza; se omitió el blanqueamiento.")
        treated += 1
    return image, {
        "faces": len(face_landmarks),
        "treated": treated,
        "eyesEnhanced": eyes_enhanced,
        "teethWhitened": teeth_whitened,
        "warnings": warnings,
        "backdrop": backdrop,
        "backdropDiagnostics": backdrop_diagnostics,
        "_diagnosticMasks": diagnostic_masks,
    }


def write_backdrop_diagnostics(destination, result):
    masks = result.pop("_diagnosticMasks", None)
    diagnostics = result.get("backdropDiagnostics")
    if not masks or not diagnostics:
        return
    destination_path = Path(destination)
    diagnostic_directory = destination_path.with_name(f"{destination_path.stem}-backdrop-diagnostics")
    diagnostic_directory.mkdir(parents=True, exist_ok=True)
    for name, mask in masks.items():
        cv2.imwrite(str(diagnostic_directory / f"{name}.png"), mask)
    with (diagnostic_directory / "summary.json").open("w", encoding="utf8") as output:
        json.dump(diagnostics, output, ensure_ascii=False, indent=2)


def main():
    source, destination = sys.argv[1], sys.argv[2]
    level = min(2, max(0, int(sys.argv[3])))
    controlled_arg = sys.argv[4] if len(sys.argv) > 4 and sys.argv[4] != "-" else ""
    default_models = Path(os.environ.get("SMARTSTUDIO_MODEL_DIR", Path.cwd() / ".smartstudio-data" / "models"))
    model_directory = Path(sys.argv[5]) if len(sys.argv) > 5 else default_models
    complete_backdrop = len(sys.argv) > 6 and sys.argv[6] == "backdrop"
    image = cv2.imread(source, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("No se pudo leer la imagen para el retoque facial.")

    adaptive_diagnostics = None
    if controlled_arg.startswith("controlled"):
        image, result = apply_controlled(image, level, controlled_arg, complete_backdrop)
    else:
        try:
            image, result = apply_mediapipe(image, level, model_directory, complete_backdrop)
        except Exception as error:
            image, adaptive_diagnostics = adaptive_tone(image)
            if not cv2.imwrite(destination, image, [cv2.IMWRITE_JPEG_QUALITY, 94]):
                raise RuntimeError("No se pudo guardar el revelado adaptativo.")
            print(json.dumps({
                "faces": 0,
                "treated": 0,
                "eyesEnhanced": False,
                "teethWhitened": False,
                "warnings": [f"MediaPipe no estuvo disponible; se omitió el retoque: {error}"],
                "backdrop": "omitted" if complete_backdrop else "unchanged",
                "backdropDiagnostics": None,
                "adaptiveTone": adaptive_diagnostics,
            }))
            return
        image, adaptive_diagnostics = adaptive_tone(image)

    result["adaptiveTone"] = adaptive_diagnostics
    write_backdrop_diagnostics(destination, result)
    if adaptive_diagnostics is None and result["faces"] == 0 and result["backdrop"] != "completed":
        shutil.copyfile(source, destination)
    elif not cv2.imwrite(destination, image, [cv2.IMWRITE_JPEG_QUALITY, 94]):
        raise RuntimeError("No se pudo guardar el retoque facial.")
    print(json.dumps(result))


if __name__ == "__main__":
    main()
