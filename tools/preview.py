import sys
from PIL import Image
A='web/public/assets/'
W,H=600,288
def L(n): return Image.open(A+n+'.png').convert('RGBA')
img=Image.new('RGBA',(W,H))
sky=L('sky')
for x in range(0,W,sky.width): img.alpha_composite(sky,(x,0))
def tile(name,y,off=0):
    t=L(name); x=-(off%t.width)
    while x<W: img.alpha_composite(t,(x,y)) if x>=0 else img.alpha_composite(t.crop((-x,0,t.width,t.height)),(0,y)); x+=t.width
off=int(sys.argv[1]) if len(sys.argv)>1 else 0
tile('clouds',6,off//10); tile('far',212-170,off//5); tile('mid',214-200,off//2)
tile('road',210); 
img.alpha_composite(L('bus_a'),(300,236-46+2))
tile('sidewalk',236); tile('props',246-110,off)
G=262
s=L('samuca'); fr=s.crop((84*4,0,84*5,72)); img.alpha_composite(L('shadow'),(90+27,G-3)); img.alpha_composite(fr,(90,G-70))
for n,x in [('obs_cone',200),('obs_box2',240),('obs_barrier',290),('obs_lixeira',350),('obs_hole',390)]:
    o=L(n); img.alpha_composite(o,(x,G-o.height+ (4 if n=='obs_hole' else 1)))
for n,x in [('obs_sign',450),('obs_beam',520)]:
    o=L(n); img.alpha_composite(o,(x,G-50-o.height))
c=L('coin').crop((0,0,12,12))
for k in range(5): img.alpha_composite(c,(150+k*16,G-30))
img.resize((W*2,H*2),Image.NEAREST).save(sys.argv[2] if len(sys.argv)>2 else '/tmp/claude-0/-home-claude/e34412a6-039b-53b7-83ed-a0015e709b48/scratchpad/scene.png')
