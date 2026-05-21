# Image2Studio Cloudflare Worker

Image2Studio 云任务后端，基于 Cloudflare Worker + Queues + D1 + KV。

## 能力

- `POST /api/tasks` 创建文生图/图生图云任务；
- Queue 消费任务，调用 OpenAI 兼容图片接口；
- D1 保存任务状态；
- KV 保存较大的结果图片 base64；
- `clientTaskId + deviceToken` 保护任务查询；
- `/admin`、`/api/admin/stats`、任务列表需要后台 token；
- 用户 API Key 只在 Queue 消息中用 `API_KEY_ENCRYPTION_SECRET` AES-GCM 加密暂存，不写 D1/KV/日志。

## 部署

```bash
cd cloudflare-worker
npm install
cp wrangler.toml.example wrangler.toml
# 修改 wrangler.toml 里的 D1 / Queue / KV 资源 ID
npx wrangler d1 execute image2studio_cloud_d1 --file schema.sql
npx wrangler d1 execute image2studio_cloud_d1 --file migrations/001_device_hash.sql
npx wrangler d1 execute image2studio_cloud_d1 --file migrations/002_rate_limits.sql
npx wrangler secret put API_KEY_ENCRYPTION_SECRET
npx wrangler secret put IMAGE2STUDIO_ADMIN_TOKEN
npx wrangler deploy
```

## 重要安全规则

不要提交真实的：

- `wrangler.toml`
- API Key
- Admin token
- `API_KEY_ENCRYPTION_SECRET`
- Cloudflare token

仓库只保留 `wrangler.toml.example`。
