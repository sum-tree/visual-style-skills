# Visual Style Skills

面向 ChatGPT 与 Codex 的图片风格化 Skill 合集。每个 Skill 都按上传顺序逐张处理图片，保留未经修改的真实原图，并为每张输入输出一张独立的高清 PNG 对照成品。

## Skills

| Skill | 默认效果 | 调用示例 |
| --- | --- | --- |
| `monet-comparison` | 莫奈式印象派油画 | `使用 $monet-comparison 按莫奈风格处理全部图片` |
| `picasso-geometric-comparison` | 合成立体主义、中等抽象 | `使用 $picasso-geometric-comparison 按毕加索风格处理全部图片` |

## 使用方式

- 整套使用：将仓库作为 Skill-only Plugin 安装，一次获得全部风格。
- 单独使用：通过 Skill Installer 安装 `skills/<skill-name>` 对应的 GitHub 子目录。
- 扩展风格：在 `skills/` 下新增独立目录；每个目录必须可以脱离仓库其他 Skill 单独运行。

## 共同输出约束

- 上传 N 张原图，输出 N 张独立对照图，不遗漏、不合并、不重复。
- 每张对照图只包含一张未经修改的真实原图及其对应效果图。
- 横图上下排列；竖图或正方形图左右排列。
- 背景为 `#F7F4EE`，描边为 `#E5E0D7`，画幅比例允许的最大相对偏差为 0.5%。
- 最终成品为高清 PNG，不输出中间效果图。

各风格的生成规则、重试条件和输出命名以对应目录中的 `SKILL.md` 为准。
