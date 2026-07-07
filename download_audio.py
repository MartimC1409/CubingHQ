import subprocess
import os

try:
    import imageio_ffmpeg
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    
    # We will pass this to yt-dlp via --ffmpeg-location
    cmd = [
        "python", "-m", "yt_dlp",
        "--ffmpeg-location", ffmpeg_path,
        "--download-sections", "*00:00:00-00:10:00",
        "-f", "bestaudio",
        "-x", "--audio-format", "mp3",
        "--force-overwrites",
        "-o", "competition_noise.%(ext)s",
        "https://www.youtube.com/watch?v=rHFkqvY-nrE"
    ]
    print(f"Running command: {' '.join(cmd)}")
    result = subprocess.run(cmd, capture_output=True, text=True)
    print("STDOUT:", result.stdout)
    print("STDERR:", result.stderr)
    
except Exception as e:
    print(f"Error: {e}")
