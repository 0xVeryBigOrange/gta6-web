# 素材许可

游戏里用到的第三方素材都允许再分发。角色、贴图和天空是 CC0，不要求署名；这里仍记下作者。

## 角色

- Quaternius，[Ultimate Animated Character Pack](https://quaternius.com/packs/ultimateanimatedcharacters.html)，CC0 1.0。
- 用到的模型：Casual Male、Casual Female、Casual 2 Female、Worker Male、Suit Male、Suit Female、Old Classy Male。
- 每个文件自带骨骼和动作：Idle、Walk、Run、Jump、Roll、Punch、Shoot_OneHanded、RecieveHit、Death，以及挥手等。
- 文件来自 [Yametech12/ghostname-3d-assets](https://github.com/Yametech12/ghostname-3d-assets) 里已打好的 GLB，原包仍是 Quaternius 的 CC0。

## 城市场景道具

- Kenney，CC0。经 [shorepine/kenney](https://github.com/shorepine/kenney) 镜像。
- 车：City Kit / Car Kit 的 sedan、suv、hatchback-sports、police、taxi、race、sedan-sports（橙焰超跑）。
- 船：boat-speed-a。棕榈：tree_palmTall、tree_palmDetailedTall。路灯和路牌、遮阳棚、太阳伞、手枪。
- 这些 GLB 引用各自目录里的 `Textures/colormap.png`。

## 地面、墙面和天空

Poly Haven，CC0。作者见各资产页。

- 沥青 [asphalt_02](https://polyhaven.com/a/asphalt_02) 1K 漫反射和法线。
- 人行道 [concrete_floor_worn_001](https://polyhaven.com/a/concrete_floor_worn_001) 1K。
- 沙滩 [coast_sand_01](https://polyhaven.com/a/coast_sand_01) 1K。
- 草地 [forrest_ground_01](https://polyhaven.com/a/forrest_ground_01) 1K。
- 楼立面底纹 [painted_plaster_wall](https://polyhaven.com/a/painted_plaster_wall) 1K。
- 日照 [kloofendal_48d_partly_cloudy_puresky](https://polyhaven.com/a/kloofendal_48d_partly_cloudy_puresky) 1K HDR，Greg Zaal。作环境反射。旧的 `venice_sunset` 1K HDR 仍留在仓库里作备用。

贴图压成 768 JPEG。手机自动关掉泛光、FXAA 和后期合成，阴影用普通 PCF、贴图 512，远处楼换成色块，路灯杆和遮阳棚不加载。角色文件去掉了用不到的动作片段。行人模型在标题出来之后再加载。

## 项目内制作

- 酒店、公寓、厂房的体块和窗户、霓虹字、车道线、路缘、长椅、红绿灯、水面着色器。
- 摩托、直升机、轻航。
