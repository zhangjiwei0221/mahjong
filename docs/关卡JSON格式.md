# 关卡 JSON 格式解读（给程序同学）

> 一对一档。关卡文件在仓库 `data/levels/*.json`（工作台存下来的就是这种）。编辑器「导出」、demo 加载的也是同一套结构（字段是兼容子集）。
> 坐标约定见第五节，**最容易被坑**；typeId 配对见第六节。

---

## 一、完整示例（截取自真实关卡，字段齐全的那版）

```json
{
  "key": "mt752ogr_bmgprm",
  "name": "1",
  "levelId": 1,
  "totalPairs": 23,
  "tiles": [
    { "id": 1, "layer": 0, "row": -5, "col": -3, "typeId": 27, "isDark": false },
    { "id": 2, "layer": 0, "row": -3, "col": -3, "typeId": 2,  "isDark": false },
    ... {"id":53, "layer":3, "row":-4, "col":2, "typeId":32, "spitterOrder":1, "isDark":false}
  ],
  "specialTiles": [
    { "id": 38, "type": "dark", "layer": 1, "row": -3, "col": -5 }
  ],
  "_difficulty": { "score": 75, "clickRatio": 0.196, "hooks": 21, "...": "见第七节" },
  "order": 1,
  "status": "wip",
  "playTimeMs": 49220,
  "createdAt": "2026-08-24T11:14:44.187Z"
}
```

---

## 二、顶层字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `key` | string | 唯一标识（工作台用 `时间戳36进制_随机` 生成，如 `mt752ogr_bmgprm`） |
| `name` | string | 关卡名（策划起的名，可重复；`key` 才是唯一） |
| `levelId` | int | 一般是 1（内部用，各关不可拍号无关） |
| `totalPairs` | int | 总对数 = `tiles.length / 2`（花色必须成对） |
| `tiles` | array | **牌列表**，见第三节 |
| `specialTiles` | array | **特殊牌列表**（暗牌/吐牌机），见第四节；可空 `[]` |
| `_difficulty` | object | 生成时算的难度指标，**只读参考**，见第七节 |
| `order` | int \| null | 排关序号（工作台可排序但非唯一） |
| `status` | "wip"\|"test"\|"done" | 制作进度（工作台展示用，编辑器不写） |
| `playTimeMs` | int \| null | 试玩最佳成绩（毫秒） |
| `createdAt` | string(ISO) | 保存时间 |
| `updatedAt` | string(ISO) | 最近改动时间（可选） |
| `rotation` | object \| null | 旋转配置（可选）：`{centerRow, centerCol, radius, direction}`，direction ∈ `clockwise/counterclockwise` |

---

## 三、`tiles[]` —— 每一张牌

```json
{ "id": 53, "layer": 3, "row": -4, "col": 2, "typeId": 32, "isDark": false, "spitterOrder": 1 }
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | ✓ | 1 起、按 layer→row→col 排序递增的唯一编号 |
| `layer` | ✓ | 层号，**0 = 底层** |
| `row` | ✓ | **上下（纵）**，std 坐标见第五节 |
| `col` | ✓ | **左右（横）** |
| `typeId` | ✓ int\|null | 花色/牌面编号（见第六节）；吐牌机本体为 `null`（不是可消麻将） |
| `isDark` | ✓ bool | 是否暗牌（看不到正面，点击先翻面再消） |
| `type` | 可选 "spitter" | **吐牌机本体**（不可参与配对），配合 `dir`/`count` |
| `dir` | 可选 | 吐牌机方向 `up/down/left/right` |
| `count` | 可选 int | 吐牌机队列数量（1~8） |
| `spitterOrder` | 可选 int | 吐牌机**队列牌**的序号（1 = 最先显示；非本体、是普通可消牌，typeId 正常） |

> 队列牌（有 `spitterOrder`）和普通牌一样参与配对消除，`typeId` 也要成对。

---

## 四、`specialTiles[]` —— 特殊牌声明

与 `tiles[]` 里的 `isDark`/`type` 是**同一件事的两笔记录**（tiles 管牌，specialTiles 是给 demo 明确标记）。

- **暗牌**：`{ "id": 38, "type": "dark", "layer": 1, "row": -3, "col": -5 }`
  - 语义同 `tiles` 里 `isDark:true` 的那张；`id` 需对得上。
- **吐牌机**：`{ "type": "spitter", "layer", "row", "col", "direction": "up", "count": 3 }`
  - 丢弃 store 里吐牌机可能不存 specialTiles，但编辑器导出/import 会带；`direction`（编辑器侧拼写）对应 tiles 里的 `dir`。

> 读端（编辑器 import / demo）通常只用其中一个来源。若要写导入器：以 `tiles[]` 为准，把 `isDark` 标成暗、`type==='spitter'` 标成吐牌机即可，specialTiles 可重建。

---

## 五、坐标约定（务必先看这条）

用的是 **std 坐标**，和常见"先列后行"相反，二消的亲兄弟三个坑：

1. **`row` = 上下（纵），`col` = 左右（横）**。不是 x/y。
2. **中心坐标，相邻牌相差 2**：牌占 2×2 格子，间隔 2 单位。同层横向紧挨的两张，`col` 差 2；纵向 `row` 差 2。
3. **层叠**：`layer` 越大越靠上（先消下面的才能点上面的）。渲染时上层牌**每层左偏、上偏 1 单位**（半格），造成 3D 错层观感。

**可点判定**（游戏规则核心）：
- 一张牌**可点** = 正上方无覆盖牌，**且**同一层左右**不同时**被夹（`col±2` 同 `row` 各有一张）。
- 即：被任何上层盖住 → 不可点；同层左、右都被顶住 → 不可点。
- 上层覆盖判定用相邻（`|row差|<2 且 |col差|<2`）。

---

## 六、`typeId` 与配对

- `typeId` 的**含义映射到牌面图**在 demo 侧做（`typeImgMap`：每个 typeId 均匀映射一张麻将脸；超出的 typeId 按序取未发放的脸）。
- **配对 = 两张 `typeId` 相同**。点两张同 typeId 的可点牌消除。
- **必须成对（偶数）**：`totalPairs = tiles.length/2`，每个 typeId 出现偶数次，否则无法全消。
- `typeId` 编号从 **1** 起（0 或 null = 未填色/吐牌机本体）。

---

## 七、`_difficulty`（难度指标，生成时算好，只读）

| 字段 | 含义 |
|---|---|
| `score` | 总难度分（公式：可点率×30 + 层数×8 + 钩子埋深加权 + 暗钩 + 槽位压力 + 队列压力 + 5） |
| `clickRatio` | 开局可点牌占比（越低越难） |
| `hooks` / `effHooks` | 钩子对子数 / 埋深加权钩子 |
| `darkHooks` / `effDarkHooks` | 暗钩数 |
| `hookDensity` | hooks/totalPairs（≤1） |
| `maxLayer` | 最高层（0 起） |
| `minSlots` | 最优打法下卡槽最大占用（越高容错越低，7 封顶） |
| `slotSolvable` | 贪心是否可解 |
| `typeCount` | 花色种数 |
| `queueCount` / `hiddenQueueCount` | 吐牌机队列数 / 隐藏压力队列数 |
| `totalPairs` | 总对数 |

> 前端工作台用到：`score`、`hookDensity`、`darkHookDensity`、`clickRatio`、`maxLayer`、`minSlots`、`playTimeMs`。

---

## 八、编辑器导入 / 导出

- **导出**（`exportJSON`）：把编辑器的 `state.layers` 展开成上面的 `tiles[]`（普通牌带 `typeId`，`null` 表示未填）、`specialTiles`（dark/spitter）、可选 `rotation`。
- **导入**（`loadFromEditorJSON`）：按 `layer,row,col` 读回形状；**v4.9.0 起普通牌也保留 `typeId`**（文件没 typeId 就是"只导形状"）。生成时会尽力复现原花色（若关卡完整且可解）。
- 两者字段等价，可导入→导出→导入无信息丢失（shape + typeId）。

## 九、demo 消费

demo 通过 `postMessage({ type:'loadLevel', level })` 加载，它需要：
```js
{ levelId, totalPairs, tiles, specialTiles, rotation }
```
（示例 stage：`demo/index.html` 内置 `SAMPLE_LEVEL` 就是标准示例。）

---

## 十、常见坑（调试优先级）

1. **坐标反了**：永远先确认 `row=上下、col=左右`。被当 x/y 处理会整体镜像/错位。
2. **typeId 不成对**：奇数次 → 死局。校验 `totalPairs*2 === tiles.length` 且每 typeId 偶次。
3. **`isDark` 和 `specialTiles` 二选一即可**，两者都写要保证 `id` 对齐，否则 demo 会重复翻面。
4. **id 必须唯一且 0 起/1 起递增**：demo 用 id 做 Map key，重复会渲染错乱。
5. **吐牌机本体 `typeId=null` 且不参与 paired**：别拿它去配对。