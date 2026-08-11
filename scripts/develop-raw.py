import sys
import json

import cv2
import rawpy


def main() -> None:
    source, destination = sys.argv[1], sys.argv[2]
    with rawpy.imread(source) as raw:
        rgb = raw.postprocess(
            use_camera_wb=True,
            output_color=rawpy.ColorSpace.sRGB,
            output_bps=16,
            no_auto_bright=False,
        )
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    if not cv2.imwrite(destination, bgr, [cv2.IMWRITE_TIFF_COMPRESSION, 5]):
        raise RuntimeError("No se pudo guardar el revelado RAW intermedio.")
    print(json.dumps({
        "version": rawpy.__version__,
        "parameters": {
            "use_camera_wb": True,
            "output_color": "sRGB",
            "output_bps": 16,
            "no_auto_bright": False,
        },
    }))


if __name__ == "__main__":
    main()
