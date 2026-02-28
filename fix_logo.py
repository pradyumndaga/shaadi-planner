import sys
from PIL import Image

def fix_logo():
    img = Image.open('ui/public/logo.png').convert('RGBA')
    width, height = img.size
    
    # We will use a simple form of flood-fill to find all contiguous background pixels
    # The background is a checkerboard of whites (>240) and greys (~200)
    
    def is_bg(r, g, b, a):
        # Checkerboard consists of greys and whites, so r, g, b are close to each other
        if a < 10: return True
        if r > 190 and g > 190 and b > 190 and abs(r-g) < 15 and abs(g-b) < 15:
            return True
        return False

    # Seed the flood fill from the borders
    visited = set()
    queue = []
    
    for x in range(width):
        queue.append((x, 0))
        queue.append((x, height - 1))
    for y in range(height):
        queue.append((0, y))
        queue.append((width - 1, y))
        
    pixels = img.load()
    
    while queue:
        x, y = queue.pop(0)
        
        if (x, y) in visited: continue
        visited.add((x, y))
        
        r, g, b, a = pixels[x, y]
        if is_bg(r, g, b, a):
            pixels[x, y] = (0, 0, 0, 0)
            # Add neighbors
            for dx, dy in [(-1,0), (1,0), (0,-1), (0,1)]:
                nx, ny = x + dx, y + dy
                if 0 <= nx < width and 0 <= ny < height and (nx, ny) not in visited:
                    queue.append((nx, ny))

    # Also there might be some isolated checkerboard squares if the flood fill gets blocked by anti-aliasing.
    # We can do a second pass: any remaining pixel that strongly matches the checkerboard but is isolated?
    # Better to just stick with flood fill to preserve logo internals.
    
    img.save('ui/public/logo.png')
    # Also save to the backend logo
    img.save('backend/logo.png')
    
fix_logo()
print("Logo fixed and saved to ui/public/logo.png and backend/logo.png")
