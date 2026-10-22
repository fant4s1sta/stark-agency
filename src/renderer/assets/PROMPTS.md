# Asset generation record

Mode: built-in `image_gen` (not the fallback CLI).
Reference: the user-approved original concept, saved as `concept.png`.

## office.png

Edit this pixel art office concept into a clean empty office game background asset. Preserve the beautiful pixel-art rendering, colors, warm wood, office layout, cutaway three-quarter perspective, windows, whiteboard, desks and computers, sofa, server racks, coffee station and tool workbench. Remove ALL seven characters, every humanoid and robot, their labels, ALL speech bubbles, and remove the entire bottom character lineup strip. Expand/reframe the office to fill the entire landscape image with the office scene only, no borders. Leave clear floor walkways between the whiteboard/left desk, center desks and right tool/server area so small animated character sprites can later be composited by game code. No people, no characters, no robots, no text overlay, no UI. This is the empty environment background for the exact same cozy pixel AI office.

## characters.png

Transparent background: true.

Create a transparent-background game sprite sheet based on the SEVEN characters in the bottom reference lineup. Exactly one horizontal row of SEVEN sprites with equal-width cells. Each sprite centered in its own cell, feet aligned at same baseline, plenty of transparent space around each sprite, no overlap between cells. Left to right: VISION white android in waistcoat, ULTRON silver angular robot red eyes, JARVIS gray-haired human gentleman dark suit notebook, FRIDAY red-haired woman teal suit, EDITH dark bob-haired glasses woman burgundy outfit, DUM-E yellow small articulated utility robot, U blue-gray small camera-head robot. Use chunky clean square pixel art, full body, front three-quarter standing game idle poses, dark outlines, consistent scale and lighting matching reference. Each cell same width. Robots DUM-E and U shorter naturally. No ground plane, no shadows outside sprite, NO TEXT, no labels, no background, no UI. Output a wide landscape sheet aspect ratio about 3:1. Keep all seven characters fully visible. Actual transparent alpha background.

这些图片保留为早期概念资产。当前场景与角色由 `src/renderer/pixel-art.js` 直接绘制，不再裁切此图；DUM-E 和 U 的现行造型均为机械臂，DUM-E 体型更大。
