# Yunfei Ge 个人学术网站：现状、维护、验收与部署计划

> 文档性质：本文件不再只是“准备做什么”，而是对当前已经完成的网站进行逐项记录，并作为后续内容更新、本地验收、GitHub 版本管理、公开部署、自定义域名配置和故障回滚的操作手册。
>
> 当前状态：网站主体已完成；目前尚未初始化为 Git 仓库、尚未推送 GitHub、尚未公开部署。

---

## 1. 网站目标与定位

网站是 Yunfei (Faye) Ge / 葛芸菲的英文个人学术主页，主要面向：

- 潜在 PhD 导师与招生委员会。
- 学术合作者、实验室成员和会议同行。
- 研究或 AI 工程岗位的招聘方。
- 希望查看论文、研究方向、经历和联系方式的访客。

核心目标：

1. 在首屏立即说明姓名、当前身份、学校和研究方向。
2. 清楚表达正在寻找 Fall 2027 PhD opportunity。
3. 用最少的点击展示 publications、experience 和 education。
4. 让访客可以直接通过 Email、GitHub 或 LinkedIn 联系或了解本人。
5. 保持网站为纯静态页面，不依赖后端、数据库、登录、CMS 或第三方构建服务。
6. 在本地确认效果后再提交和发布，避免未验收内容直接出现在公网。

---

## 2. 当前技术架构

### 2.1 技术选型

当前网站由以下三部分组成：

- `index.html`：页面结构、内容、SEO 元信息和所有链接。
- `assets/css/styles.css`：视觉设计、桌面/平板/手机布局和无障碍样式。
- `assets/js/main.js`：移动端菜单以及滚动时的导航高亮。

网站没有使用：

- React、Vue、Next.js、Hugo 或 Jekyll。
- npm 依赖和 `node_modules`。
- 构建命令或生成后的 `dist` 目录。
- 服务端 API、数据库或用户登录。
- Cookie、Analytics 或访客追踪脚本。

因此部署时，托管平台只需把项目根目录作为静态文件目录公开即可。

### 2.2 当前文件清单

```text
personal_website/
├── .gitignore
├── IMG_8990.JPG
├── README.md
├── img.jpg
├── index.html
├── plan.md
└── assets/
    ├── css/
    │   └── styles.css
    ├── images/
    │   ├── favicon.png
    │   ├── mindtopo.webp
    │   ├── mmg2skill-fig1.webp
    │   ├── mmg2skill.webp
    │   ├── neurips-logo.webp
    │   ├── profile-640.webp
    │   └── profile-960.webp
    └── js/
        └── main.js
```

### 2.3 文件职责与当前使用情况

| 文件 | 当前作用 | 是否由网页加载 | 维护说明 |
|---|---|---:|---|
| `index.html` | 唯一页面入口 | 是 | 修改个人内容、链接和页面区块时编辑 |
| `assets/css/styles.css` | 全部布局与视觉样式 | 是 | 修改颜色、间距、响应式布局时编辑 |
| `assets/js/main.js` | 菜单与导航状态 | 是 | 页面区块或导航结构变化时同步检查 |
| `profile-640.webp` | 普通密度屏幕头像 | 是 | 640×640，约 32 KB |
| `profile-960.webp` | 高密度屏幕头像 | 是 | 960×960，约 60 KB |
| `neurips-logo.webp` | MindTopo 条目配图 | 是 | 640×640，约 20 KB |
| `mmg2skill-fig1.webp` | MMG2Skill 条目配图 | 是 | 640×142，约 20 KB |
| `favicon.png` | 浏览器标签页图标 | 是 | 128×128，约 32 KB |
| `mindtopo.webp` | 备用 MindTopo 图片 | 否 | 当前 HTML 未引用，可保留或删除 |
| `mmg2skill.webp` | 备用 MMG2Skill 图片 | 否 | 当前 HTML 未引用，可保留或删除 |
| `IMG_8990.JPG` | 原始头像素材 | 否 | 约 16 MB，不应被网页直接引用 |
| `img.jpg` | 中间裁切素材 | 否 | 约 1.7 MB，不应被网页直接引用 |
| `README.md` | 本地预览简介 | 否 | 可扩充为维护入口 |
| `plan.md` | 本项目完整说明 | 否 | 每次结构或部署方式改变时更新 |

注意：原图虽然不会被浏览器加载，但如果整个项目提交到 GitHub，它仍会进入仓库并增加 clone 体积。正式建库前应决定：

- 保留原图：便于未来重新裁切，但仓库体积增加约 18 MB。
- 不提交原图：把 `IMG_8990.JPG` 和 `img.jpg` 加入 `.gitignore`，只提交优化后的 WebP。推荐采用此方案。

---

## 3. 当前页面逐项说明

### 3.1 `<head>` 与页面元信息

当前配置包括：

- 页面语言：`lang="en"`。
- 字符编码：UTF-8。
- 移动端 viewport。
- 页面标题：`Yunfei Ge`。
- 搜索引擎 description：说明 Northwestern M.S. 身份和 embodied AI、multimodal agents、robot learning 方向。
- Open Graph title、description、type 和 image。
- favicon。
- 主样式表 `assets/css/styles.css`。

部署后应补充：

1. `link rel="canonical"`，指向最终正式网址。
2. `og:url`，指向最终正式网址。
3. 将 `og:image` 从相对路径改为完整公网 URL，例如：

   ```html
   <meta property="og:image" content="https://invalidcodes.github.io/assets/images/profile-960.webp">
   ```

4. 可补充 `twitter:card="summary_large_image"`、`twitter:title`、`twitter:description` 和 `twitter:image`。
5. 若后续绑定自定义域名，以上 URL 统一换成自定义域名，不能同时混用 GitHub Pages 域名。

### 3.2 Skip link

页面正文前包含 `Skip to main content` 链接：

- 默认隐藏在页面上方。
- 键盘聚焦时显示。
- 点击后直接跳到 `#main`。
- 用于帮助键盘用户和屏幕阅读器用户跳过重复导航。

### 3.3 顶部导航

当前导航组成：

- 左侧品牌文字 `Yunfei Ge`，链接到 `#home`。
- 右侧三个栏目：Publications、Experience、Education。
- 手机端菜单按钮，包含 `aria-expanded` 和 `aria-controls`。

当前行为：

- Header 高度桌面端为 72 px，手机端为 64 px。
- Header 使用 sticky 定位，页面滚动时固定在顶部。
- 背景为半透明白色并带模糊效果。
- 点击栏目平滑滚动到对应 section。
- 当前可见栏目会获得 `.active` 状态。
- 手机端菜单点击按钮打开；点击栏目或导航外区域后关闭。

当前导航没有独立 About 链接；这是刻意保持简洁的结果。若未来加入 Research、Awards、CV 等栏目，需要同时修改：

1. `index.html` 中 `.nav-links`。
2. 正文中对应 section 的唯一 `id`。
3. 检查 `main.js` 是否能通过新链接自动找到对应 section。
4. 检查手机菜单是否因链接变多而超出首屏。

### 3.4 页面整体布局

主容器 `.page-shell`：

- 最大宽度 1240 px。
- 页面左右最小留白 20 px，手机端留白 14 px。
- 桌面端为两列 Grid。
- 左列最小宽度 320 px，放置个人资料卡。
- 右列占剩余宽度，放置正文内容。
- 两列间距 44 px。
- 顶部留白 48 px，底部留白 72 px。

在 980 px 以下：

- 页面改为单列。
- 个人资料卡不再 sticky。
- 个人资料卡内部先变成“190 px 图片 + 右侧文字”的横向结构。

在 760 px 以下：

- 个人资料卡改为完全单列。
- 头像最大显示宽度 220 px。
- 顶部导航折叠。
- Publications、Experience 等内容改为适合手机的单列布局。

### 3.5 左侧个人资料卡

当前展示内容：

- 头像。
- 英文名 `Yunfei (Faye) Ge`。
- 中文名 `葛芸菲`。
- 身份 `M.S. Student in Computer Engineering`。
- 学校 `Northwestern University`。
- 三个研究标签：Embodied AI、Multimodal Agents、Robot Learning。
- Email、GitHub、LinkedIn 三个图标链接。

头像实现：

- `<picture>` 提供 640 和 960 像素 WebP。
- 浏览器根据屏幕密度选择合适资源。
- 图片声明 640×640 尺寸，降低加载时布局跳动。
- `alt="Portrait of Yunfei Ge"`。
- 桌面端显示宽度为资料卡的 84%。
- 使用正方形比例、`object-fit: cover` 和 8 px 圆角。

头像来源：

- 原图 `IMG_8990.JPG`：7728×5152 横图，约 16 MB。
- 输出 `profile-640.webp` 和 `profile-960.webp`。
- 现有成品均为正方形，使用原图全高的 5152×5152 区域裁切；人物占画面比例较小，保留完整墨镜、头发、肩部、上半身以及更多天空、建筑和海滩背景。
- 裁切只使用原始照片真实像素，没有生成式扩图、换脸、美化或背景替换。
- 网页没有加载原始 JPG。

资料链接：

- Email：`yunfeige2027@u.northwestern.edu`。
- GitHub：`https://github.com/InvalidCodes`。
- LinkedIn：`https://www.linkedin.com/in/yunfei-faye-ge`。
- 外部链接使用新标签页，并包含 `rel="noopener noreferrer"`。
- 图标使用内联 SVG，避免额外加载图标字体或第三方脚本。

未来可选扩展：

- Google Scholar。
- ORCID。
- PDF CV/Resume。
- X/Twitter。

只有真实页面或文件存在时才加入，不放无法打开的空链接。

### 3.6 About 与 PhD 提示

正文第一段说明：

- Northwestern University Computer Engineering 硕士身份。
- 与 Qineng Wang、Prof. Manling Li、MLL Lab 的合作。
- 研究方向为 spatial reasoning 和 multimodal agents。
- 与 Prof. Michael Yip、UCSD ARCLab 的合作。
- 研究方向为 embodied AI 和 robot learning。

其后用红色加粗文本突出：

`Looking for a Fall 2027 PhD opportunity. Please feel free to reach out!`

上线前必须人工确认：

- “work as an intern with Qineng Wang, Prof. Manling Li” 的英文关系是否准确自然。
- MLL Lab 与 ARCLab 的正式拼写。
- 是否应写 “UC San Diego” 或 “University of California San Diego”。
- 研究关系和导师信息是否已经获得公开许可。

### 3.7 News

当前 News 位于 About 下方的白色面板中，包含：

- Jun 2026：MMG2Skill preprint released；论文名链接至 `https://arxiv.org/abs/2606.01993`，在新标签页打开。
- Sep 2025：开始 Northwestern M.S. 学习和研究。

数据结构：

- 每条使用 `<time datetime="YYYY-MM">`。
- 日期和 emoji 放在第一列。
- 事件描述放在第二列。
- 日期为绿色，描述使用手写风格 fallback 字体。

更新规则：

1. 最新消息放在最上方。
2. 日期显示格式保持 `Mon YYYY`。
3. `datetime` 使用机器可读 `YYYY-MM`。
4. 内容尽量一句话完成。
5. 论文状态变化时同步修改 Publications，避免两处信息冲突。

### 3.8 Publications

当前栏目 eyebrow 为 `Selected Work`，主标题为 `Publications`。

#### MindTopo

- 标题：`MindTopo: Can Foundation Models Reason in Topological Space?`
- Yunfei Ge 使用红色突出，并标注 equal contribution `*`。
- 当前状态：`NeurIPS 2026 under review`。
- 配图：`neurips-logo.webp`。
- 当前没有 Paper、Project、Code 链接。

上线前确认：

- under review 信息是否允许公开。
- 作者列表、星号和 `§` 的含义是否需要加注释。
- 如果已有 arXiv/project page，应增加链接。
- 直接使用会议 Logo 是否符合预期；若有论文 teaser，通常更能说明研究内容。

#### MMG2Skill

- 标题：`MMG2Skill: Can Agents Distill In-the-Wild Guides into Self-Evolving Skills?`
- Yunfei Ge 使用红色突出并标注 equal contribution。
- 状态：Preprint。
- 链接：`https://arxiv.org/abs/2606.01993`，显示文字为 `arXiv`。
- 配图：`mmg2skill-fig1.webp`。

上线前建议：

- 若有 code/project page，增加 `[Code]`、`[Project]`。
- 再次核对作者次序、星号和论文状态。

Publication 排版：

- 桌面端每条为 190 px 图片 + 正文。
- 图片带边框、6 px 圆角和白底。
- Logo 使用 `object-fit: contain`。
- 横图使用 16:9 容器与 `object-fit: contain`。
- 手机端图片在上、正文在下，图片最大宽度 280 px。

### 3.9 Experience

当前使用纵向时间线，共七项：

1. Jun 2026–Present：Research Intern · ARC Lab, University of San Diego。
2. Sep 2025–Present：Research Intern · MLL Lab, Northwestern University。
3. Nov 2025–Dec 2025：AI Engineer Intern · Wegwiser。
4. Apr 2025–Aug 2025：Research Intern · Scale Lab, Shanghai Jiao Tong University。
5. Apr 2025–Aug 2025：AI Engineer Intern · Duo LuoLuo。
6. Nov 2023–May 2024：Software Engineer Intern · SAIC Maxus。
7. Sep 2021–Apr 2023：Vision Group Member · RoboMaster Robotics Competition (National Third Prize)。

样式：

- 紫色时间线和圆形节点。
- 桌面端日期与职位左右分列。
- 手机端日期和职位上下排列。

上线前必须核对：

- 第一项正文 About 写的是 UCSD，Experience 写的是 `University of San Diego`。两者是不同学校，应确认后统一；如果是 Prof. Michael Yip 的实验室，通常应核对是否为 UC San Diego。
- `ARC Lab`/`ARCLab` 的正式空格和大小写。
- `Scale Lab` 的正式名称和机构链接。
- `Duo LuoLuo` 与 `Wegwiser` 的官方英文拼写。
- RoboMaster 的时间、成员身份和 `National Third Prize` 奖项表述是否与正式获奖证明一致。
- 是否为每段经历增加 1–3 条成果描述；目前只有职位与时间。

### 3.10 Education

当前时间线：

- 2027–2031：Ph.D. Study / Planned next step。
- 2025–2027：Northwestern University，M.S. in Computer Engineering，GPA 4.0/4.0。
- 2021–2025：Shanghai University，B.Eng. in Computer Science and Technology，Freshman Scholarship, Top 5%。

上线前必须决定：

- 是否保留尚未获得 offer 的 `2027–2031 Ph.D. Study`。公开学术主页通常只列真实教育经历；申博意向已在红色提示中表达。推荐删除未来学位卡片，避免被理解为已经确定 PhD 去向。
- GPA 和 Top 5% 是否愿意公开。
- 学位名称和年份是否与正式 CV 完全一致。
- `Freshman Scholarship` 是否需要更精确的官方英文名称。

---

## 4. 当前视觉设计系统

### 4.1 颜色变量

当前 CSS 根变量：

| 变量 | 值 | 用途 |
|---|---|---|
| `--bg` | `#f7f9fb` | 页面浅灰背景 |
| `--surface` | `#ffffff` | 卡片与导航背景 |
| `--text` | `#1d2730` | 主文字 |
| `--muted` | `#63717f` | 次级信息 |
| `--line` | `#dbe4ec` | 边框和分隔线 |
| `--accent` | `#4e2a84` | Northwestern 紫色 |
| `--accent-dark` | `#3f1f70` | 链接和重点文字 |
| `--warm` | `#6f579c` | hover 与 eyebrow |
| `--news` | `#20895a` | News 日期 |
| `--alert` | `#b42318` | PhD 提示和本人作者名 |

页面背景是紫色半透明渐变叠加浅灰底色；卡片使用白底、浅灰边框和轻量阴影。

### 4.2 字体

- 正文：Apple/Windows 系统无衬线字体栈。
- 手写效果：`Chalkboard SE` → `Comic Sans MS` → `Comic Neue` → cursive。
- 手写字体用于研究身份、学校、News 描述和论文作者。
- 未加载外部 Web Font，因此不同操作系统显示会略有差异。

如要求所有设备视觉完全一致，需要加入自托管字体并核对字体许可；否则维持当前轻量方案。

### 4.3 间距、圆角与阴影

- 主 Header：72 px；手机 64 px。
- Section 上下间距：36 px；手机 32 px。
- Profile 卡片内边距：26 px；手机 18 px。
- 卡片圆角：8 px。
- Publication 图片圆角：6 px。
- 卡片阴影：`0 18px 40px rgba(24, 40, 56, 0.08)`。
- 正文行高：1.65。
- About 文字最大宽度：76 个字符单位。

### 4.4 响应式断点

#### 大于 980 px

- 页面双栏。
- 左侧 Profile sticky。
- Publications 图片与正文并排。
- Experience 日期与职位并排。

#### 761–980 px

- 页面单栏。
- Profile 变为横向卡片。
- Profile 不再 sticky。

#### 小于等于 760 px

- Header 变矮。
- 菜单按钮显示。
- 导航下拉面板绝对定位于 Header 下方。
- Profile 变为纵向卡片。
- Publications、Experience、Education 改为单列。
- Publication 图片最大宽度 280 px。

#### Reduced motion

当用户系统开启减少动画时：

- 关闭平滑滚动。
- 将 transition 和 animation 压缩到近乎零时长。

---

## 5. 当前 JavaScript 行为

`assets/js/main.js` 共负责两类交互。

### 5.1 手机菜单

1. 查询 `.menu-toggle` 和 `.nav-links`。
2. 点击按钮切换 `.open` class。
3. 同步 `aria-expanded="true/false"`。
4. 点击任意导航链接后关闭菜单。
5. 点击导航区域外部后关闭菜单。

### 5.2 当前栏目高亮

1. 读取 `.nav-links a` 的 `href`。
2. 根据 href 找到对应 section。
3. 使用 `IntersectionObserver` 监听 Publications、Experience、Education。
4. 在视口中选择交叉比例最高的 section。
5. 为对应导航链接添加 `.active`。

观察参数：

- `rootMargin: "-22% 0px -62% 0px"`。
- `threshold: [0.12, 0.3, 0.55]`。

已知边界：

- Home/About 不在右侧导航监听列表中，因此回到页面顶部时三个栏目可能维持上一次的高亮状态。
- 如果将来添加导航栏目，只要 href 与 section id 一致，脚本通常可以自动纳入监听。

---

## 6. 无障碍、隐私与安全

### 6.1 已实现

- HTML 使用 `header`、`nav`、`aside`、`main`、`section`、`article` 等语义标签。
- 页面只有一个主要 `h1`。
- 有 Skip link。
- 导航有 `aria-label`。
- 菜单按钮有可访问名称、状态和控制目标。
- 头像与论文图片都有 alt。
- 图标 SVG 对屏幕阅读器隐藏，链接本身有 aria-label。
- 键盘 focus 使用 3 px 可见轮廓。
- 外部新窗口链接使用 `noopener noreferrer`。
- 支持 reduced motion。
- 无 Cookie、Analytics、表单或访客数据收集。

### 6.2 上线前检查

- 键盘 Tab 顺序是否符合视觉顺序。
- 菜单打开后是否可以用键盘正常访问所有链接。
- 颜色对比度是否达到 WCAG AA。
- 放大到 200% 时是否仍可阅读。
- 手机端是否产生横向滚动。
- 所有 alt 是否描述图片用途，而非重复附近标题。
- 邮箱公开后可能收到垃圾邮件；如介意，应改为文字混淆或联系表单服务。

---

## 7. 性能与资源策略

当前实际页面资源较轻：

- 两张头像分别约 32 KB 和 60 KB。
- 当前两张 publication 图片各约 20 KB。
- favicon 约 32 KB。
- CSS 和 JavaScript 均为本地文件。
- 没有外部字体、框架或第三方脚本。

重要规则：

1. 不在 HTML 中引用 `IMG_8990.JPG` 或 `img.jpg`。
2. 新增图片优先输出 WebP；照片可视情况使用 AVIF/WebP 双格式。
3. Publication 图片应设置明确 `width` 和 `height`。
4. 首屏头像可以保持普通加载；首屏以下 publication 图片可增加 `loading="lazy"`。
5. 单张网页图片尽量不超过 300 KB。
6. 不为少量交互引入大型 JavaScript 框架。

---

## 8. 上线前内容门禁

以下项目必须由本人确认后才能公开部署：

### P0：必须处理

- [ ] 统一 `UCSD` 与 `University of San Diego`，避免写成不同学校。
- [ ] 确认是否删除 `2027–2031 Ph.D. Study / Planned next step`。
- [ ] 确认邮箱、GitHub 和 LinkedIn 链接均愿意公开。
- [ ] 确认论文作者顺序、贡献符号和状态准确。
- [ ] 确认所有实习时间、职位名称和机构名称准确。
- [ ] 确认没有保密项目、未公开投稿信息或未经许可的合作关系。

### P1：强烈建议处理

- [ ] 为 MindTopo 增加论文或项目链接（如已公开）。
- [ ] 决定是否加入 PDF CV；当前项目中没有简历文件。
- [ ] 决定是否加入 Google Scholar/ORCID。
- [ ] 删除或忽略未使用的 `mindtopo.webp`、`mmg2skill.webp`。
- [ ] 将 16 MB 原图和 1.7 MB 中间图加入 `.gitignore`，避免推送。

### P2：绑定域名后处理

- [ ] 设置 canonical URL。
- [ ] 设置 `og:url`。
- [ ] 将 `og:image` 改为绝对 URL。
- [ ] 增加 Twitter/X 分享卡元信息。
- [ ] 检查社交平台抓取到的标题、简介和图片。

---

## 9. 本地预览与验收

### 9.1 启动本地服务器

不要只双击 `index.html`；应通过本地 HTTP 服务模拟公开网站。

```bash
cd /Users/yunfei/Intern/personal_website
python3 -m http.server 8000
```

浏览器打开：

```text
http://localhost:8000
```

停止服务：在运行服务器的终端按 `Ctrl+C`。

此操作只在本机开放预览，不会 push，也不会自动发布到互联网。

### 9.2 每次发布前的人工检查

#### 桌面端 1440×900

- [ ] Header 固定，正文不会被 Header 遮挡。
- [ ] Profile 卡片 sticky 正常。
- [ ] 姓名不溢出卡片。
- [ ] Publications 图片和文字对齐。
- [ ] Experience 与 Education 时间线连续。

#### 平板端 768×1024

- [ ] 页面变为单列。
- [ ] Profile 显示为图片与文字并排。
- [ ] 所有文字和链接保持可读。
- [ ] 页面没有横向滚动条。

#### 手机端 390×844

- [ ] 菜单按钮出现。
- [ ] 菜单能打开、关闭；点击外部可关闭。
- [ ] Profile 图片居中，姓名可换行。
- [ ] Publications 图片位于文字上方。
- [ ] News 日期与内容没有挤压或截断。
- [ ] Education 时间线节点位置正确。

#### 内容与链接

- [ ] Email 打开正确收件地址。
- [ ] GitHub 和 LinkedIn 指向本人页面。
- [ ] arXiv 链接可打开。
- [ ] 所有本地图片返回成功。
- [ ] favicon 正常显示。
- [ ] 页面没有拼写、年份和机构名称错误。

#### 技术质量

- [ ] 浏览器控制台无 JavaScript 错误。
- [ ] Network 中没有 404。
- [ ] HTML 只有一个 `h1`，标题顺序合理。
- [ ] 200% 缩放时内容仍可使用。
- [ ] 键盘可完成导航。
- [ ] Lighthouse Accessibility、SEO、Performance 没有明显高优先级问题。

### 9.3 发布门禁

严格执行以下顺序：

```text
修改内容
  → 本地 HTTP 预览
  → 手机/平板/桌面检查
  → 内容和链接复核
  → Git commit
  → push
  → 托管平台生成公开版本
  → 在线复核
```

不要把 `push` 当作预览手段。公开站点应始终对应一个已在本地确认的 commit。

---

## 10. 推荐部署方案：GitHub Pages

### 10.1 为什么推荐

当前网站是零构建的纯静态页面，GitHub Pages 足够且最简单：

- 不需要修改现有项目结构。
- 不需要构建命令。
- 每次 push 到 `main` 后自动更新网站。
- 免费提供 HTTPS 和 `github.io` 地址。
- 后续可以绑定自己的域名。

GitHub 账号当前链接为 `InvalidCodes`。如果创建用户主页仓库，建议仓库名使用：

```text
invalidcodes.github.io
```

默认公开网址将是：

```text
https://invalidcodes.github.io/
```

若仓库使用其他名称，例如 `personal_website`，网址通常会带仓库路径：

```text
https://invalidcodes.github.io/personal_website/
```

虽然当前资源路径是相对路径，两种方式都可以工作，但个人主页仓库地址更简洁。

### 10.2 建库前清理

推荐在 `.gitignore` 增加：

```gitignore
IMG_8990.JPG
img.jpg
```

原因：两者不是网页运行所需文件，合计约 18 MB。优化后的头像已经位于 `assets/images/`。

同时检查项目中不存在：

- 私人手机号、住址或不希望公开的邮箱。
- API key、密码、token、`.env`。
- 未公开的论文、审稿材料或保密文件。
- 不希望公开的照片元数据原件。

### 10.3 初始化 Git

在项目目录执行：

```bash
cd /Users/yunfei/Intern/personal_website
git init
git branch -M main
git add .
git status
git commit -m "Create personal academic website"
```

在 `git add .` 后必须先看 `git status`，确认原始 JPG 没有进入提交。

### 10.4 创建 GitHub 仓库

在 GitHub 网页：

1. 点击 New repository。
2. Owner 选择 `InvalidCodes`。
3. Repository name 填 `invalidcodes.github.io`。
4. 如果使用 GitHub Free 并按最通用流程部署，选择 Public。
5. 不要再次自动生成 README、`.gitignore` 或 License，避免和本地文件冲突。
6. 创建仓库。

然后将 GitHub 显示的远程地址连接到本地：

```bash
git remote add origin https://github.com/InvalidCodes/invalidcodes.github.io.git
git push -u origin main
```

### 10.5 开启 GitHub Pages

进入仓库：

1. 打开 `Settings`。
2. 左侧进入 `Pages`。
3. `Build and deployment` → `Source` 选择 `Deploy from a branch`。
4. Branch 选择 `main`。
5. Folder 选择 `/(root)`。
6. 保存。
7. 等待 GitHub 显示部署成功。
8. 打开 `https://invalidcodes.github.io/`。

GitHub Pages 网站是公开可访问的；即使某些付费方案允许从 private repository 发布，生成的网站也不应被视作私密存储。

### 10.6 后续更新

每次修改：

```bash
cd /Users/yunfei/Intern/personal_website
python3 -m http.server 8000
```

本地检查通过并停止服务器后：

```bash
git status
git add index.html assets README.md plan.md
git commit -m "Update publications and experience"
git push
```

推送后等待 Pages 部署完成，再在线检查首页、图片和外部链接。

### 10.7 回滚

如果新版本出现问题：

1. 不要直接删除整个仓库。
2. 找到上一个正常 commit。
3. 使用 `git revert <problem-commit>` 创建反向提交。
4. push 反向提交。
5. 等待 GitHub Pages 重新部署。

使用 `git revert` 可以保留历史，比强制覆盖远程分支更安全。

---

## 11. 备选部署方案：Cloudflare Pages

Cloudflare Pages 也适合当前静态站，尤其适合未来使用自定义域名和 Cloudflare DNS。

### 11.1 推荐选择 Git integration

建议先把项目放到 GitHub，然后在 Cloudflare：

1. 打开 Workers & Pages。
2. 选择 Create application → Pages → Connect to Git。
3. 授权并选择网站仓库。
4. Production branch 选择 `main`。
5. Framework preset 选择无框架/None。
6. Build command 留空。
7. Build output directory 使用项目根目录 `.`。
8. 保存并部署。

之后每次 push 到 `main` 自动更新生产站；其他分支可产生预览地址。

Cloudflare 官方说明：Git integration 与 Direct Upload 是两种不同项目模式，创建后不能直接互相切换。因此若希望未来 push 自动部署，应一开始就选 Git integration。

### 11.2 Direct Upload 仅适合临时快速公开

也可以在 Cloudflare 控制台选择 Drag and drop，直接上传网站目录，得到 `*.pages.dev` 地址。

但它的缺点是：

- 每次更新需要再次上传。
- 无法在同一个项目中切换成 Git integration。
- 不如 Git + 自动部署容易追踪版本。

因此当前项目推荐 GitHub Pages，或 GitHub + Cloudflare Pages Git integration；不推荐把 Direct Upload 作为长期方案。

---

## 12. 自定义域名

可以先使用免费地址，确认网站稳定后再购买和绑定域名。

域名示例：

- `yunfeige.com`
- `yunfeige.me`
- `fayege.com`

购买前检查：

- 简短、容易拼写和口述。
- 不含连字符或不必要数字。
- 与论文作者名保持一致。
- 能长期使用，不与单个学校绑定。

### GitHub Pages 绑定流程

1. Repository Settings → Pages。
2. 在 Custom domain 填入域名。
3. 保存。
4. 在域名 DNS 服务商添加 GitHub 要求的记录。
5. 等待 DNS 生效。
6. 开启 Enforce HTTPS。
7. 同时更新 canonical、`og:url` 和 `og:image`。

DNS 记录必须以 GitHub 页面当时显示的官方配置为准，不从旧教程复制可能过期的 IP。

### Cloudflare Pages 绑定流程

1. 进入 Pages 项目。
2. 打开 Custom domains。
3. 添加根域名或 `www` 子域名。
4. 如果域名 DNS 已在 Cloudflare，按向导自动配置。
5. 确认 HTTPS 证书正常。
6. 决定根域名与 `www` 哪个是主地址，并将另一个重定向到主地址。

---

## 13. 正式上线后的检查

首次部署完成后立即检查：

- [ ] 首页公网可打开。
- [ ] HTTP 自动跳转 HTTPS。
- [ ] 手机网络下加载速度正常。
- [ ] CSS 和 JavaScript 没有 404。
- [ ] 头像、favicon 和两张 publication 图片显示正常。
- [ ] 菜单、锚点和 active 状态正常。
- [ ] Email、GitHub、LinkedIn、arXiv 均可打开。
- [ ] 网页源码中没有本地绝对路径 `/Users/yunfei/...`。
- [ ] 页面标题和搜索摘要正确。
- [ ] 将网址发送到 Slack/LinkedIn 等平台时，分享标题和图片正确。
- [ ] 在无登录、隐私浏览窗口中仍可访问，证明访客无需本人账号。

一周内再次检查：

- [ ] 搜索引擎是否能抓取首页。
- [ ] 自定义域名和证书是否稳定。
- [ ] 是否收到真实访客反馈。
- [ ] 是否需要增加 Scholar、CV 或 project page。

---

## 14. 内容维护规则

### 新增 News

1. 在 `.news-list` 顶部增加一个 `<li>`。
2. 使用正确 `datetime`。
3. 保持一句话。
4. 如果涉及论文状态，同步更新 Publications。

### 新增 Publication

1. 准备优化后的 WebP teaser。
2. 放入 `assets/images/`。
3. 在 `.work-list` 顶部加入新的 `<article class="work-item">`。
4. 核对标题、作者顺序、本人突出、贡献符号、venue/status。
5. 添加 Paper、Code、Project 链接。
6. 图片加入明确宽高和 alt；首屏以下可 `loading="lazy"`。
7. 在手机和桌面端检查图片比例。

### 新增 Experience

1. 按结束/开始时间倒序。
2. 使用统一日期格式 `Mon YYYY - Mon YYYY` 或 `Mon YYYY - Present`。
3. 机构名称使用官方英文。
4. 最好增加可量化成果，而不只列职位。

### 更新 Education

1. 只列已经开始或确认的教育经历。
2. 学位、专业、学校和时间与 CV 一致。
3. GPA、奖学金和排名仅在愿意公开时展示。

### 修改导航

1. 新增导航链接。
2. 新增匹配的 section id。
3. 本地验证滚动定位与 active 状态。
4. 验证手机菜单高度与关闭行为。

---

## 15. 推荐执行顺序

### 阶段 A：上线前内容修正

1. 处理 UCSD/University of San Diego 不一致。
2. 决定是否删除未来 PhD 卡片。
3. 核对所有论文与经历。
4. 决定是否加入 CV 和 Scholar。
5. 完善分享元信息。

### 阶段 B：本地最终验收

1. 启动本地 HTTP 服务。
2. 检查三个目标视口。
3. 检查键盘、菜单、链接和资源。
4. 修复所有 P0 问题。

### 阶段 C：建立版本管理

1. 忽略原始大图。
2. 初始化 Git。
3. 检查首次提交清单。
4. 创建 `invalidcodes.github.io` 仓库。
5. 推送 `main`。

### 阶段 D：公开部署

1. GitHub Pages 选择 `main` + `/(root)`。
2. 等待首次部署。
3. 完成公网验收。
4. 把网址加入 GitHub、LinkedIn、简历和邮件签名。

### 阶段 E：可选自定义域名

1. 购买域名。
2. 配置域名和 HTTPS。
3. 设置主域名跳转。
4. 更新 canonical/Open Graph URL。

---

## 16. 完成标准

网站可以认为正式完成，需要同时满足：

- 内容事实和公开范围经本人确认。
- P0 检查全部通过。
- 本地三个目标视口无明显问题。
- 所有资源和链接正常。
- 原始大图与敏感文件没有误提交。
- GitHub 中存在可回滚的清晰提交历史。
- 公网 HTTPS 地址可由未登录访客访问。
- 分享预览与搜索摘要正确。
- 后续更新流程已经记录并可重复执行。

---

## 17. 官方部署资料

- GitHub Pages 创建站点：<https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site>
- GitHub Pages 自定义域名：<https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site>
- Cloudflare Pages Git integration：<https://developers.cloudflare.com/pages/get-started/git-integration/>
- Cloudflare Pages Direct Upload：<https://developers.cloudflare.com/pages/get-started/direct-upload/>
