import sys

import cv2
import numpy as np
import rawpy


def main() -> None:
    source, destination = sys.argv[1], sys.argv[2]
    with rawpy.imread(source) as raw:
        rgb = raw.postprocess(
            use_camera_wb=True,
            output_color=rawpy.ColorSpace.sRGB,
            output_bps=8,
            no_auto_bright=False,
        )
        orientation = raw.sizes.flip
    if orientation == 3:
        rgb = rgb[::-1, ::-1]
    elif orientation == 5:
        rgb = np.rot90(rgb, 1)
    elif orientation == 6:
        rgb = np.rot90(rgb, 3)
    bgr = cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR)
    if not cv2.imwrite(destination, bgr, [cv2.IMWRITE_PNG_COMPRESSION, 2]):
        raise RuntimeError("No se pudo guardar el revelado RAW intermedio.")


if __name__ == "__main__":
    main()
