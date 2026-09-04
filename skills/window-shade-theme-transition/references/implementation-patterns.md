# 实现模式

只在需要写代码、排查闪屏或校准手感时读取本页。以下是框架无关的参考模型；适配目标项目的状态管理和命名，不要机械新增第二套主题系统。

## 三类状态

- `progress`：连续挡板进度 `0…1`，只负责即时视觉反馈。
- `settledTheme`：已提交的离散主题 `light | dark`，负责语义令牌和持久化。
- `phase`：`idle | dragging | settling | committing`，用于打断动画、防止重复 click 和清理资源。

不要把 `progress > 0.5` 直接等同于当前主题。拖动到 49% 与 51% 都应仍是同一套稳定令牌，直到吸附真正到达 `0` 或 `1`。

## 色幕公式

设 `p=0` 为亮端点，`p=1` 为暗端点：

```text
settledTheme = light: veilColor = darkBackground, veilOpacity = p
settledTheme = dark:  veilColor = lightBackground, veilOpacity = 1 - p
```

色幕固定定位、覆盖视口、不可接收指针，并处于页面内容之上、机械控件之下。拖动时取消色幕自身 transition，直接更新 opacity。

端点提交顺序：

```text
1. 吸附动画抵达目标端点。
2. 确认色幕在目标背景色上接近完全不透明。
3. 提交 data-theme／class／ThemeProvider 状态并保存偏好。
4. 下一帧把色幕 opacity 缓动到 0。
5. 淡出完成后清除临时 transition、phase 与内联值。
```

若目标项目让 ThemeProvider 异步提交，可等待 DOM 上的主题标记真实变化后再淡出，不能只等待任意固定延时。

## 指针状态机

```ts
onPointerDown(event) {
  if (event.button !== 0) return
  cancelSettlingAnimation()
  event.currentTarget.setPointerCapture(event.pointerId)
  phase = 'dragging'
  drag = { startY: event.clientY, startProgress: progress, moved: false }
}

onPointerMove(event) {
  if (phase !== 'dragging') return
  const delta = (event.clientY - drag.startY) / travelPx
  progress = clamp(drag.startProgress + delta, 0, 1)
  drag.moved ||= Math.abs(delta) > dragThreshold
  renderProgress(progress)
}

onPointerUpOrCancel(event) {
  if (phase !== 'dragging') return
  safelyReleasePointerCapture(event.pointerId)
  phase = 'settling'
  const target = chooseEndpoint(progress, recentVelocity, 0.5)
  animateFromCurrentProgressTo(target)
}

onClick() {
  if (drag.moved || clickOccurredSoonAfterPointerUp) return
  animateFromCurrentProgressTo(settledTheme === 'light' ? 1 : 0)
}
```

`travelPx` 应来自挡板允许移动的实际距离，而不是整个页面高度。拖动起点可以落在窗洞任意位置，因此必须记录 `startProgress`，不能每次按绝对指针坐标重算。组件卸载时取消 `requestAnimationFrame`、计时器和监听器。

普通产品 UI 使用约 280–700 ms 的端点吸附通常足够；距离短时按剩余距离缩短动画。若使用弹簧，保持轻阻尼且不要明显过冲到 `0…1` 之外。`prefers-reduced-motion` 下直接提交目标端点。

## 渲染与性能

每帧写入一个 CSS 自定义属性即可驱动全部视觉层：

```css
.shade-control {
  --shade-p: 0;
}

.shade-panel {
  transform: translate3d(0, calc((var(--shade-p) - 1) * var(--shade-travel)), 0);
  will-change: transform;
}

.shade-frame {
  filter: brightness(calc(1 - var(--shade-p) * 0.75));
}

.theme-veil {
  position: fixed;
  inset: 0;
  pointer-events: none;
  opacity: var(--veil-opacity, 0);
  will-change: opacity;
}
```

在 React、Vue 或 Svelte 中，连续进度可保存在 ref／局部可变状态并直接写 CSS 变量；只在可访问名称或稳定主题变化时触发框架状态更新。不要逐帧查询大量 `getComputedStyle`，端点背景色可在拖动开始时读取一次。

## 首屏恢复

SSR 或静态页面需要在首屏样式绘制前恢复主题。优先使用项目框架官方的无闪屏方案；没有现成方案时，在 `<head>` 中放置最小同步脚本，只读取一个明确的主题键并设置根元素标记：

```js
try {
  const saved = localStorage.getItem('app-theme')
  if (saved === 'dark') document.documentElement.dataset.theme = 'dark'
} catch {}
```

若站点有严格 CSP，把脚本作为同源小文件并配置允许来源，或使用项目既有 nonce／hash 机制。不要为了消除闪屏而放宽到 `unsafe-inline`。客户端状态初始化必须读取根元素的实际主题，以避免 hydration 后反向跳变。

## 可访问行为

- 使用 `button type="button"`；`aria-pressed="true"` 表示暗端点，名称采用动作式文案，例如“打开遮光板，切换到亮色主题”。
- Enter 和 Space 复用点击切换。可选支持 ArrowUp／ArrowLeft 到亮、ArrowDown／ArrowRight 到暗，但必须在说明或可发现性足够时采用。
- 机械图片、阴影、云层等均设为空 alt 或 `aria-hidden="true"`；状态不要只靠声音、颜色或窗口画面表达。
- 色幕不得获得焦点，也不能阻止页面输入。主题切换结束后保持原有焦点，不自动滚动。

## 浏览器验收矩阵

至少检查：

1. 亮端点、50% 中间态、暗端点截图；中间态色幕透明度与挡板位置方向一致。
2. 阈值前后释放、快速反向拖动、拖动中再输入、pointer cancel、组件卸载。
3. 点击、Enter、Space、清晰焦点环和状态名称变化。
4. 刷新恢复暗主题且首帧无亮闪；localStorage 禁用时仍能切换。
5. `prefers-reduced-motion: reduce`、窄屏、触摸滚动邻接区域、高缩放与高对比度模式。
6. Performance 面板中拖动不触发布局抖动或整页框架重渲染；连续动画主要落在 transform／opacity 合成层。
