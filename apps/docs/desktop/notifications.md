# Notifications

Yanshi sends native macOS notifications for key runtime events, and they follow the app's UI
language (英文 / 中文).

## When you get notified

| Event | Notification |
|---|---|
| Approval requested | "Yanshi approval requested" / 偃师请求审批 |
| Chat completed | "Yanshi chat completed" / 偃师对话已完成 |
| Chat failed | "Yanshi chat failed" / 偃师对话失败 |
| Runtime error | "Yanshi runtime error" / 偃师运行时错误 |

Notification titles are locale-aware, so a zh-CN user sees 偃师, not "Yanshi".

## Controls

Toggle desktop notifications in **Settings → Notifications**. Notifications are functional in dev;
a packaged interactive pass (tray, notifications, global shortcut, close-prompt) is part of the
[human verification checklist](/release/limitations).
