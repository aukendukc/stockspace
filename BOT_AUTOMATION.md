# Bot Automation Guide

The backend exposes helper endpoints so that scheduled jobs (Azure Functions, GitHub Actions, etc.) can publish automated market updates without requiring a human account.

## Environment variables

| Name | Description |
|------|-------------|
| `BOT_USER_ID` | Numeric ID of the user that should author automated posts (e.g. a dedicated "@ai_bot" account). |
| `BOT_API_KEY` | Optional shared secret. When set, callers must provide it via the `X-Bot-Key` header. |

## Upload workflow

1. Upload a chart/image to `POST /uploads/images` (multipart form-data, field name `file`). The API responds with `{"url": "/uploads/<filename>"}`.
2. Use the returned URL when posting bot content (optional).

## Endpoints

### `POST /posts/bot/publish`

Custom bot post for arbitrary events.

```json
{
  "text": "決算速報: トヨタの営業益が市場予想を上回りました。",
  "stock_symbol": "7203",
  "chart_image_url": "https://<api>/uploads/123.png",
  "event": "Earnings"
}
```

Include `X-Bot-Key: <BOT_API_KEY>` when the key is configured.

### `POST /posts/bot/summary`

Generates a short summary using the top gainer / loser from the `stocks` table. No payload is required—trigger it after the daily price refresh.

```bash
curl -X POST https://<api>/posts/bot/summary \
  -H "Authorization: Bearer <service-token>" \
  -H "X-Bot-Key: <BOT_API_KEY>"
```

Both endpoints return the standard `PostResponse`, so they can be chained with workflow automation or logging systems.

