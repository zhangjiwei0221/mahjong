# 麻将消一消(Mahjong Match-3)

> 单机休闲消除手游——经典"上海麻将"二消玩法,点两张相同花色且左右不被挡住的牌即可消除。

这是项目的**编辑器 + 工作台 + Demo + 后端**完整工具链仓库,适合策划/关卡设计者批量生产关卡。

---

## 快速开始(本地使用)

### 1. 安装 Node.js

如果电脑上没有 Node.js,先去 [nodejs.org](https://nodejs.org/) 下载安装(>= 14 版本即可,推荐 LTS)。Windows 安装时**勾选 "Add to PATH"**。

### 2. 双击启动脚本

| 操作系统 | 启动脚本 |
|---|---|
| Windows | `启动编辑器.bat` |
| macOS | `启动编辑器.command`(需要右键 → 打开方式 → 终端,首次双击可能被 Gatekeeper 拦截) |
| Linux | 终端执行 `bash 启动编辑器.command` 或 `node serve.js` |

脚本会自动:
- 检查 Node.js 是否安装
- 找一个可用端口(默认 9002)
- 启动本地静态服务器
- 自动打开浏览器到编辑器页面

启动后访问:

| 入口 | 地址 |
|---|---|
| 编辑器(画形状 + 生成关卡) | http://localhost:9002/editor/ |
| 工作台(管理关卡 + 预览试玩) | http://localhost:9002/workbench.html |
| 游戏 Demo(纯试玩) | http://localhost:9002/demo/ |

按 Ctrl+C 停止服务器(在启动的黑色窗口里)。

### 3. 不喜欢 bat / command?

直接终端执行也行:

```bash
node serve.js            # 默认 9002 端口
node serve.js 8080       # 自定义端口
```

---

## 功能列表

### 编辑器(`/editor/`)

- **画笔**:普通麻将、暗牌、吐牌机、圆盘、旋转中心
- **生成关卡**:按当前形状生成、按当前底座堆塔生成、批量生成
- **难度模式**:1-10 滑轮自动映射分数/钩子/暗牌
- **参数模式**:详细滑轮控制生成参数
- **实时预览**:右侧 iframe 直接试玩当前编辑的关卡
- **导出 / 导入 JSON**:本地保存、跨电脑传递关卡
- **保存到工作台**:把当前关卡推到共享关卡库

### 工作台(`/workbench.html`)

- **列表浏览**:所有已保存关卡(可搜索/排序/筛选)
- **预览试玩**:内嵌 iframe 试玩任意关卡
- **下载 / 删除 / 改名 / 排号**:管理关卡
- **关卡详情**:张数、难度分、暗牌数、钩子密度、层数、试玩时长
- **共享协作**:多人共享关卡库(需要在线部署模式)

### 游戏 Demo(`/demo/`)

- 纯试玩环境:导入 JSON 关卡 → 试玩
- 支持暗牌、吐牌机、圆盘、旋转机制
- 内置示例关卡:`?sample=disc` 加载圆盘示例
- 计时器 / 卡槽 / 撤销 / 重玩 / 通关判定

---

## 在线 vs 本地 — 关键差异

仓库默认是**本地静态服务器**模式,关卡存哪里、能不能多人协作,取决于用哪种部署:

### 本地模式(默认)

- **关卡保存**:`编辑器的 "保存到工作台"` 会调用 `/levels` API,**本地服务器没有后端,这个功能不可用**
- **替代方案**:编辑 → "下载 JSON" → 手工管理文件
- **数据位置**:`localStorage`(浏览器本地)、下载的 JSON 文件
- **适合**:个人使用、单电脑关卡设计、试玩验证

### 在线部署模式(原 GitHub Pages / Cloudflare Pages)

- **关卡保存**:API 把关卡写到 GitHub 仓库 `data/levels/` 目录,所有人共享
- **共享协作**:多人可以同时编辑、互看对方关卡
- **需要**:
  - Cloudflare Pages 项目 + GitHub 仓库
  - `functions/` 目录下的 Pages Functions(API 后端)
  - 环境变量 `WORKBENCH_PASSWORD`(共享口令)
- **详见**:`docs/` 下的历史工作日志和策划案

**如果接手人不需要多人协作,本地模式完全够用——画形状、生成关卡、本地试玩都能做。**

---

## 典型工作流

### 画一个新关卡

1. 启动编辑器 → 选择画笔(普通/暗牌/吐牌机/圆盘/旋转)→ 在画布上点画
2. 切换图层(L0/L1/...):左侧"图层"按钮增减
3. **按当前形状生成**:一键填色 + 自动生成可解关卡
4. 右侧预览区实时试玩:消除一对、看 disc 淡出
5. 满意后 → **下载 JSON** 存到本地(本地模式)或 **保存到工作台**(在线模式)

### 试玩一个旧关卡

1. 打开 Demo(http://localhost:9002/demo/)→ "📂 导入关卡" → 选 JSON 文件
2. 或:打开工作台 → 列表点"预览"按钮

### 看示例关卡

- Demo URL 加 `?sample=disc` 加载示例圆盘关卡(82 张 / 5 个 disc)
- `?sample=dark` 加载示例暗牌关卡

---

## 项目结构

```
麻将消一消_在线/
├── editor/                      # 编辑器(网页)
│   ├── index.html               # 编辑器页面
│   └── generator.js             # 关卡生成器 + 难度公式
├── demo/                        # 游戏 Demo(网页)
│   ├── index.html               # Demo 页面(含所有游戏机制)
│   └── 示例关卡/                # 示例 JSON 关卡
├── workbench.html               # 工作台(关卡管理)
├── functions/                   # Cloudflare Pages Functions(API 后端,在线模式用)
├── docs/                        # 文档
│   ├── 工作日志.md              # 开发日志(按天记录)
│   ├── 策划案_编辑器工作台难度v2.md
│   ├── 使用说明.md
│   └── 难度分说明.md
├── serve.js                     # 本地静态服务器(本仓库提供)
├── 启动编辑器.bat               # Windows 一键启动
├── 启动编辑器.command           # macOS / Linux 一键启动
├── version.json                 # 版本号 + 变更日志
├── CLAUDE.md                    # 给 Claude 的项目说明(项目背景 + 协作规范)
└── README.md                    # 本文件
```

---

## 注意事项

### 数据安全

- **本地模式**没有自动备份,定期 "下载 JSON" 存到磁盘 / 云盘
- 浏览器 localStorage 清缓存会丢未导出的关卡

### 协作规范

如果接手后还有第二个人一起用,强烈建议部署到 Cloudflare Pages,用 `functions/` + GitHub 共享关卡:
1. 把仓库推到 GitHub
2. Cloudflare Pages 连接这个 repo
3. 设置环境变量 `WORKBENCH_PASSWORD=某口令`(工作台登录用,目前是 `1`)
4. 推送后自动部署

详细部署步骤参考 `docs/` 下历史日志的部署相关章节。

### 版本号

三段式语义化版本 `v主版本.次版本.修订号`:

| 变更类型 | 版本号变化 |
|---|---|
| 重大变更(架构重写、玩法变化) | 主版本 +1 |
| 新增功能、重要改进 | 次版本 +1 |
| 修复 / 小调整 | 修订号 +1 |

每次改动都需要:
1. 改 `version.json` 的 `version` 字段
2. 同步 `editor/index.html` 的 `window.APP_VERSION`
3. 在 `version.json` 的 `changelog` 数组和 `editor/index.html` 的 `#changelogPop` 弹层**顶部**追加新版本记录
4. 在 `docs/工作日志.md` 加当天 Day 条目

### 编辑器 vs Demo 端 bug

- **编辑器 / 生成器**:`editor/` 目录(改完用 `node serve.js` 重新加载浏览器即可)
- **Demo 端(试玩、动画、disc 淡出)**:`demo/index.html`(改完同样重新加载)

---

## 开发提示

### 调试

- 编辑器和 Demo 的渲染逻辑都在 `*.html` 文件里,**所有 JS 内联在 HTML 中**(没有外部 JS bundle),改完浏览器刷新即可生效
- 浏览器 DevTools Console 看 `[clickTile]` / `[checkMatch]` 等 console.log
- 编辑器的画笔 snap / hoverCell 计算在 `editor/index.html:1566` 附近
- Demo 的 disc 渲染在 `demo/index.html:776` 附近

### 修改难度公式

`editor/generator.js` 里的 `evaluateDifficulty()` 函数,改完点"按当前形状生成"立刻看到效果。

### 扩展机制

添加新机制(如新画笔、新消解规则):
1. 编辑器侧:`editor/index.html` 加画笔按钮 + 渲染分支
2. Demo 侧:`demo/index.html` 加识别分支 + 渲染 + 交互
3. 导出 JSON 字段(扩展现有 schema,老 JSON 仍能加载)

---

## 相关资源

- **GitHub 仓库**:https://github.com/zhangjiwei0221/mahjong
- **在线部署**(历史):https://mahjong-90y.pages.dev
- **当前版本**:见 `version.json`

---

## 维护者寄语

这个工具链是为批量生产数百关卡而设计的,核心思路是:
1. **形状 + 填色分离**:手工设计 L0 形状 → 程序自动填花色 + 生成上层 → 自动评分
2. **闭环验证**:每个生成的关卡能直接在 Demo 试玩,失败形态立刻暴露
3. **共享协作**:多策划共享关卡库 + 难度分统一口径

如果接手人想做单人项目,本地模式完全够用;如果团队协作,把 `functions/` 部署到 Cloudflare Pages 即可启用共享。

祝使用愉快。
