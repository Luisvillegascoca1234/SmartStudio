import json
import shutil
import sys

import cv2
import numpy as np


def ellipse_mask(shape, face):
    mask = np.zeros(shape[:2], dtype=np.uint8)
    x, y, w, h = face
    cv2.ellipse(mask, (x + w // 2, y + h // 2), (int(w * .43), int(h * .48)), 0, 0, 360, 255, -1)
    return mask


def main():
    source, destination = sys.argv[1], sys.argv[2]
    level = int(sys.argv[3])
    controlled_arg = sys.argv[4] if len(sys.argv) > 4 else ""
    controlled = controlled_arg.startswith("controlled")
    image = cv2.imread(source, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("No se pudo leer la imagen para el retoque facial.")
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    if controlled:
        height, width = image.shape[:2]
        if controlled_arg.startswith("controlled:") and controlled_arg.removeprefix("controlled:").isdigit():
            face_count = max(1, int(controlled_arg.removeprefix("controlled:")))
            face_width = .82 / face_count
            faces = [(int(width * (.04 + index * (.92 / face_count))), int(height * .15), int(width * face_width), int(height * .55)) for index in range(face_count)]
        else:
            faces = [(int(width * .63), int(height * .07), int(width * .31), int(height * .48))]
    else:
        cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
        faces = list(cascade.detectMultiScale(gray, 1.1, 5, minSize=(64, 64)))
    eye_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_eye.xml")
    smile_cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_smile.xml")
    warnings = []
    treated = 0
    for x, y, w, h in faces:
        if w < 64 or h < 64:
            warnings.append("Un rostro era demasiado pequeño para tratarlo con confianza.")
            continue
        mask = ellipse_mask(image.shape, (x, y, w, h))
        if level > 0:
            diameter = 5 if level == 1 else 7
            smooth = cv2.bilateralFilter(image, diameter, 22 if level == 1 else 32, 22 if level == 1 else 32)
            skin = cv2.cvtColor(image, cv2.COLOR_BGR2YCrCb)
            skin_mask = cv2.inRange(skin, (0, 133, 77), (255, 180, 135))
            alpha = cv2.GaussianBlur(cv2.bitwise_and(mask, skin_mask), (0, 0), 3).astype(np.float32)[:, :, None] / 255
            strength = .20 if level == 1 else .34
            image = np.clip(image * (1 - alpha * strength) + smooth * alpha * strength, 0, 255).astype(np.uint8)
        roi_gray = gray[y:y+h, x:x+w]
        eyes = list(eye_cascade.detectMultiScale(roi_gray[:h//2], 1.1, 5, minSize=(18, 12)))
        if controlled and controlled_arg != "controlled:uncertain" and not eyes:
            eyes = [(int(w*.18), int(h*.32), int(w*.18), int(h*.12)), (int(w*.62), int(h*.32), int(w*.18), int(h*.12))]
        if not eyes:
            warnings.append("No se detectaron ojos con confianza en un rostro; se omitió su mejora.")
        for ex, ey, ew, eh in eyes[:2]:
            eye = image[y+ey:y+ey+eh, x+ex:x+ex+ew]
            b, g, r = cv2.split(eye)
            red = (r.astype(np.float32) > g * 1.35) & (r.astype(np.float32) > b * 1.35)
            r[red] = ((g[red].astype(np.uint16) + b[red].astype(np.uint16)) // 2).astype(np.uint8)
            corrected = cv2.merge((b, g, r))
            detail = cv2.addWeighted(corrected, 1.08, cv2.GaussianBlur(corrected, (0, 0), 1), -0.08, 3)
            image[y+ey:y+ey+eh, x+ex:x+ex+ew] = detail
        smiles = list(smile_cascade.detectMultiScale(roi_gray[h//2:], 1.5, 20, minSize=(25, 10)))
        if controlled and controlled_arg != "controlled:uncertain" and not smiles:
            smiles = [(int(w*.32), int(h*.25), int(w*.36), int(h*.12))]
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
    if not faces:
        warnings.append("No se detectaron rostros; no se aplicó retoque facial.")
        shutil.copyfile(source, destination)
        print(json.dumps({"faces": 0, "treated": 0, "warnings": warnings}))
        return
    if not cv2.imwrite(destination, image, [cv2.IMWRITE_JPEG_QUALITY, 92]):
        raise RuntimeError("No se pudo guardar el retoque facial.")
    print(json.dumps({"faces": len(faces), "treated": treated, "warnings": warnings}))


if __name__ == "__main__":
    main()
