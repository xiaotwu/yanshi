from __future__ import annotations

from dataclasses import dataclass

from yanshi_runtime.models import PermissionMode, RiskLevel


@dataclass(frozen=True)
class PermissionDecision:
    risk_level: RiskLevel
    requires_approval: bool
    blocked: bool
    reason: str


class PermissionPolicy:
    # Substring matches against a space-padded, lowercased task. zh-CN terms are included because the
    # app is macOS/zh-first; CJK has no word boundaries, so plain substring matching is correct for
    # them. (Natural-language matching is a backstop — per-action/tool risk gating is the stronger
    # control and is tracked separately.)
    critical_blocklist = (
        "payment",
        "pay ",
        "purchase",
        "wire transfer",
        "send message",
        "send email",
        "delete important",
        "change system settings",
        "system settings",
        "external transfer",
        # zh-CN
        "付款",
        "支付",
        "转账",
        "汇款",
        "购买",
        "下单",
        "发送邮件",
        "发邮件",
        "发送消息",
        "发消息",
        "删除重要",
        "系统设置",
        "修改系统",
    )
    high_risk_terms = (
        "delete",
        "move files",
        "move file",
        "run command",
        "upload",
        "submit form",
        "terminal",
        # zh-CN
        "删除",
        "移动文件",
        "运行命令",
        "执行命令",
        "上传",
        "提交表单",
        "终端",
        "命令行",
    )
    medium_risk_terms = (
        "click",
        "type",
        "open app",
        "browser",
        "computer",
        "shortcut",
        # zh-CN
        "点击",
        "输入",
        "打开应用",
        "浏览器",
        "电脑",
        "快捷键",
    )

    def classify_task(self, task: str) -> RiskLevel:
        normalized = f" {task.lower()} "
        if any(term in normalized for term in self.critical_blocklist):
            return "critical"
        if any(term in normalized for term in self.high_risk_terms):
            return "high"
        if any(term in normalized for term in self.medium_risk_terms):
            return "medium"
        return "low"

    def decide(self, task: str, mode: PermissionMode) -> PermissionDecision:
        risk = self.classify_task(task)
        normalized = f" {task.lower()} "
        if risk == "critical" and any(term in normalized for term in self.critical_blocklist):
            return PermissionDecision(
                risk_level=risk,
                requires_approval=False,
                blocked=True,
                reason="This request crosses Yanshi's full-access boundary.",
            )

        if mode == "default":
            requires_approval = risk in ("medium", "high", "critical")
        elif mode == "auto_review":
            requires_approval = risk in ("high", "critical")
        else:
            requires_approval = risk == "critical"

        return PermissionDecision(
            risk_level=risk,
            requires_approval=requires_approval,
            blocked=False,
            reason="Approval is required by the active permission mode." if requires_approval else "Allowed by policy.",
        )
