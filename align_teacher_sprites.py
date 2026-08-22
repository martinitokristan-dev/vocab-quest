import os
from PIL import Image

def normalize_all_sprites():
    guide_dir = "frontend-game/public/assets/guide"
    TARGET_WIDTH = 400
    TARGET_HEIGHT = 800
    FEET_BASELINE_Y = 760  # Y coordinate where the bottom-most heel rests
    TARGET_BODY_HEIGHT = 680 # Standard standing height from head top to feet bottom

    standard_frames = [
        'F1.png', 'F2.png', 'F3.png', 'F4.png', 'F5.png', 'F6.png', 'F7.png', 'F8.png', 'F9.png',
        'teacher_blue_incorrect_1.png',
        'teacher_blue_incorrect_2.png',
        'teacher_blue_incorrect_3.png',
        'teacher_blue_correct_1.png',
        'teacher_blue_correct_2.png',
        'teacher_blue_correct_3.png',
        'teacher_blue_pose1.png',
        'teacher_blue_pose2.png',
        'teacher_yellow_pose1.png',
        'teacher_yellow_pose2.png',
        'teacher_yellow_happy.png',
        'teacher_yellow_sad.png',
        'G1.png', 'G2.png', 'G3.png', 'G4.png', 'G5.png', 'G6.png', 'G7.png', 'G8.png', 'G9.png',
        'teacher_gevina_correct_1.png',
        'teacher_gevina_correct_2.png',
        'teacher_gevina_correct_3.png',
        'teacher_gevina_incorrect_1.png',
        'teacher_gevina_incorrect_2.png',
        'teacher_gevina_incorrect_3.png',
    ]

    for f in standard_frames:
        p = os.path.join(guide_dir, f)
        if not os.path.exists(p):
            print(f"Skipping missing {f}")
            continue

        img = Image.open(p).convert("RGBA")
        bbox = img.getbbox()
        if not bbox:
            continue

        crop = img.crop(bbox)
        crop_w, crop_h = crop.size

        scale_factor = TARGET_BODY_HEIGHT / crop_h
        new_w = int(crop_w * scale_factor)
        new_h = int(crop_h * scale_factor)

        resized = crop.resize((new_w, new_h), Image.Resampling.NEAREST)

        # Center by the character's feet/standing centerline (TARGET_WIDTH / 2 = 200)
        import numpy as np
        arr = np.array(resized)
        alpha = arr[:, :, 3]
        lower_alpha = alpha[int(new_h * 0.6):, :]
        y_idx, x_idx = np.where(lower_alpha > 50)
        if len(x_idx) > 0:
            feet_center = np.mean(x_idx)
            paste_x = int(round((TARGET_WIDTH / 2.0) - feet_center))
        else:
            paste_x = (TARGET_WIDTH - new_w) // 2

        paste_y = FEET_BASELINE_Y - new_h

        canvas = Image.new("RGBA", (TARGET_WIDTH, TARGET_HEIGHT), (0, 0, 0, 0))
        canvas.paste(resized, (paste_x, paste_y), resized)
        canvas.save(p, "PNG")
        print(f"Normalized {f} -> bbox {canvas.getbbox()}, paste_x={paste_x}")

    # Normalize correct 1 (clapping celebration) to match head/body height
    correct1_path = os.path.join(guide_dir, "teacher_blue_correct_1.png")
    if os.path.exists(correct1_path):
        img = Image.open(correct1_path).convert("RGBA")
        crop = img.crop(img.getbbox())
        w, h = crop.size
        new_h = 705
        new_w = int(w * (new_h / h))
        resized = crop.resize((new_w, new_h), Image.Resampling.NEAREST)
        canvas = Image.new("RGBA", (TARGET_WIDTH, TARGET_HEIGHT), (0, 0, 0, 0))
        paste_x = (TARGET_WIDTH - new_w) // 2
        paste_y = FEET_BASELINE_Y - new_h
        canvas.paste(resized, (paste_x, paste_y), resized)
        canvas.save(correct1_path, "PNG")
        print(f"Normalized teacher_blue_correct_1.png -> bbox {canvas.getbbox()}")

if __name__ == '__main__':
    normalize_all_sprites()
