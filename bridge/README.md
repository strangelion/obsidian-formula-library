# Formula Library Bridge

本地 Bridge 服务，为 Obsidian Formula Library 插件提供增强功能。

## 功能

| 功能 | 无 Bridge | 有 Bridge |
|------|-----------|-----------|
| 公式渲染 | MathLive 内置 | KaTeX 渲染 |
| SVG 导出 | 不支持 | ✅ |
| MathML 导出 | 不支持 | ✅ |
| HTML 导出 | 不支持 | ✅ |

## 安装

```bash
cd bridge
npm install
```

## 启动

```bash
cd bridge
npm start
```

服务默认运行在 `http://127.0.0.1:28765`。

自定义端口：
```bash
BRIDGE_PORT=3000 npm start
```

## API

### 健康检查
```
GET /health
→ { ok: true, version: "1.0.0", katex: true }
```

### LaTeX 转换
```
POST /convert
Content-Type: application/json

{
  "latex": "E = mc^2",
  "targets": ["html", "svg", "mathml"]
}

→ {
    "ok": true,
    "result": {
      "html": "<span class='katex'>...</span>",
      "svg": "<svg>...</svg>",
      "mathml": "<math>...</math>"
    }
  }
```

### 导出
```
POST /export
Content-Type: application/json

{
  "latex": "E = mc^2",
  "format": "html"
}

→ { "ok": true, "output": "...", "format": "html" }
```

## 在插件中启用

1. 启动 Bridge 服务
2. 在 Obsidian 设置 > Formula Library 中：
   - 启用 Bridge
   - 设置 URL（默认 `http://127.0.0.1:28765`）

## 技术栈

- Node.js（无框架，使用内置 `http` 模块）
- KaTeX（LaTeX 渲染）
- 零外部运行时依赖（除 KaTeX）
