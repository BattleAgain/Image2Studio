# Image2Studio Hybrid v2.0.0 SPEC

## 架构

方案 C：原生 Java Android 外壳 + WebView 高质量 HTML UI + Java Bridge。

## UI

- WebView 加载本地 `file:///android_asset/index.html`。
- HTML/CSS 做现代生图工作台：顶部品牌、模式切换、参数卡片、结果画廊、历史画廊、设置页。
- 视觉重点：不像网页表单，要像移动端创作工具。

## Bridge

Android Java Bridge 暴露：

- `getSettings()` / `saveSettings(json)`
- `requestModels(requestId, baseUrl, apiKey)`
- `generateText(requestId, baseUrl, apiKey, model, prompt, negativePrompt, n, ratio, quality)`
- `pickImages()`
- `generateEdit(requestId, baseUrl, apiKey, model, prompt, n, ratio, quality)`
- `saveCurrentToGallery(requestId)`
- `loadHistory()` / `saveHistoryItemToGallery(index)` / `clearHistory()`

## image2 参数规则

比例只保留：

- Auto
- 16:9
- 9:16
- 1:1
- 4:3
- 3:4

清晰度只保留：

- Auto
- 4K

size 规则：

- 清晰度 Auto：不传 `size`
- 清晰度 4K：
  - 16:9 → `3840x2160`
  - 9:16 → `2160x3840`
  - 1:1 → `2880x2880`
  - 4:3 → `3200x2400`
  - 3:4 → `2400x3200`
  - Auto → `2880x2880`

## 存储

- 生成后自动保存到 App 私有目录 `files/images`。
- 历史保存到 SharedPreferences，包含 prompt、模式、时间、图片路径。
- 用户点击保存时通过 MediaStore 复制到 `Pictures/Image2Studio`。

## 版本

- versionName `2.0.0`
- versionCode `7`
