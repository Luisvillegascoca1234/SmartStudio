import json
import shutil
import sys

import cv2
import lensfunpy


def main():
    source, destination, maker, model, lens_model, focal, aperture = sys.argv[1:8]
    image = cv2.imread(source, cv2.IMREAD_COLOR)
    if image is None:
        raise RuntimeError("No se pudo leer la imagen para corregir la lente.")
    database = lensfunpy.Database()
    cameras = database.find_cameras(maker, model)
    lenses = database.find_lenses(cameras[0], None, lens_model) if cameras else []
    if not cameras or not lenses:
        shutil.copyfile(source, destination)
        print(json.dumps({"applied": False}))
        return
    height, width = image.shape[:2]
    modifier = lensfunpy.Modifier(lenses[0], cameras[0].crop_factor, width, height)
    modifier.initialize(float(focal), float(aperture), 10.0, pixel_format=image.dtype.type)
    coordinates = modifier.apply_geometry_distortion()
    if coordinates is None:
        shutil.copyfile(source, destination)
        print(json.dumps({"applied": False}))
        return
    corrected = cv2.remap(image, coordinates, None, cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
    cv2.imwrite(destination, corrected)
    print(json.dumps({"applied": True}))


if __name__ == "__main__":
    main()
