from pathlib import Path
from PIL import Image
source = Image.open("public/icon-512.png").convert("RGBA")
for directory, size in [("mdpi",48),("hdpi",72),("xhdpi",96),("xxhdpi",144),("xxxhdpi",192)]:
    for name in ["ic_launcher.png", "ic_launcher_round.png"]:
        source.resize((size,size),Image.Resampling.LANCZOS).save(Path("android/app/src/main/res")/("mipmap-"+directory)/name)
for directory, factor in [("mdpi",1),("hdpi",1.5),("xhdpi",2),("xxhdpi",3),("xxxhdpi",4)]:
    canvas = Image.new("RGBA",(round(108*factor),round(108*factor)),(23,62,52,255))
    icon = source.resize((round(66*factor),round(66*factor)),Image.Resampling.LANCZOS)
    canvas.alpha_composite(icon,((canvas.width-icon.width)//2,(canvas.height-icon.height)//2))
    canvas.save(Path("android/app/src/main/res")/("mipmap-"+directory)/"ic_launcher_foreground.png")
for path in Path("android/app/src/main/res").glob("drawable*/splash.png"):
    Image.new("RGB",(64,64),(246,245,239)).save(path)
source.convert("RGB").resize((1024,1024),Image.Resampling.LANCZOS).save("ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png")
