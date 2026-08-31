# Visual Style Skills

面向 ChatGPT、Codex 与 OpenAI Image API 的图片风格化合集。仓库同时提供可独立安装的 Skill，以及调用 `gpt-image-2` 的轻量 Web APP。每个流程都按上传顺序逐张处理图片，保留真实原图，并为每张输入输出独立高清 PNG 对照成品。

## Web APP

APP 位于 `apps/web`，通过 Monorepo 中的 `packages/style-registry` 读取各 Skill 的 `app-style.json`，并通过 `packages/comparison-composer` 确定性制作原图与效果图对照成品。

主要能力：

- 多图上传、排序和逐张独立处理。
- 七种预置风格及黑白／彩色、抽象强度等风格变体。
- 草稿、标准、高清三档 `gpt-image-2` 画质。
- 最多两个任务并发，保持输入与结果的稳定顺序。
- 原图、效果图和最终 PNG 对照图分别预览；效果图与对照图可单独下载。
- API Key 只存在服务端，不进入浏览器代码。

本地运行：

```powershell
npm install
Copy-Item apps/web/.env.example apps/web/.env.local
# 在 apps/web/.env.local 中设置 OPENAI_API_KEY
npm run dev
```

默认访问 `http://localhost:3000`。未配置 API Key 时，界面可以正常打开，但生成接口会返回明确的配置提示。

验证：

```powershell
npm run check
```

图像生成接口和参数以 [OpenAI Image generation 文档](https://developers.openai.com/api/docs/guides/image-generation) 为准。APP 的上传与预置风格交互结构参考并改造自 OpenAI 的 [ImageGen Photobooth Demo](https://github.com/openai/openai-imagegen-demo)，相应许可证见 `apps/web/OPENAI_DEMO_LICENSE.md`。

## Skills

| Skill | 默认效果 | 调用示例 |
| --- | --- | --- |
| `monet-comparison` | 莫奈式印象派油画 | `使用 $monet-comparison 按莫奈风格处理全部图片` |
| `picasso-geometric-comparison` | 1930 年代人物式抽象、中高强度 | `使用 $picasso-geometric-comparison 按毕加索风格处理全部图片` |
| `chinese-shanshui-comparison` | 重意境与虚实，默认黑白，可切换彩色设色 | `使用 $chinese-shanshui-comparison 按中国山水画风格处理全部图片` |
| `modern-gongbi-sketch-comparison` | 高保真现代场景、细墨线与淡矿物设色 | `使用 $modern-gongbi-sketch-comparison 按现代工笔写生风格处理全部图片` |
| `traditional-expressive-watercolor-comparison` | 大片纸白、透明色团、结构线与受控飞溅 | `使用 $traditional-expressive-watercolor-comparison 按传统意象水彩处理全部图片` |
| `modern-minimal-illustration-comparison` | 巨大留白、规则色块、浅层叙事与受控渐变 | `使用 $modern-minimal-illustration-comparison 按现代极简插画处理全部图片` |
| `wu-guanzhong-expressive-ink-comparison` | 黑白灰构成、书写性墨线与高纯度彩点 | `使用 $wu-guanzhong-expressive-ink-comparison 按吴冠中写意水墨处理全部图片` |

## 使用方式

- 整套使用：将仓库作为 Skill-only Plugin 安装，一次获得全部风格。
- 单独使用：通过 Skill Installer 安装 `skills/<skill-name>` 对应的 GitHub 子目录。
- 扩展风格：在 `skills/` 下新增独立目录；每个目录必须可以脱离仓库其他 Skill 单独运行。
- APP 预置：为 Skill 提供符合现有结构的 `app-style.json`，并在 `packages/style-registry` 注册。

## 共同输出约束

- 上传 N 张原图，输出 N 张独立对照图，不遗漏、不合并、不重复。
- 每张对照图只包含一张未经修改的真实原图及其对应效果图。
- 横图上下排列；竖图或正方形图左右排列。
- 背景为 `#F7F4EE`，描边为 `#E5E0D7`，画幅比例允许的最大相对偏差为 0.5%。
- 最终成品为高清 PNG，不输出中间效果图。

各风格的生成规则、重试条件和输出命名以对应目录中的 `SKILL.md` 为准。
