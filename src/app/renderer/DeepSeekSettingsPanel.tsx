import { FormEvent, useEffect, useState } from "react";
import type { DeepSeekSettings, DeepSeekSettingsInput } from "./petBridge";

export type DeepSeekSettingsPanelProps = {
  open: boolean;
  pending: boolean;
  settings: DeepSeekSettings | null;
  onSave(input: DeepSeekSettingsInput): void;
  onCancel(): void;
};

function sourceLabel(source: DeepSeekSettings["apiKeySource"] | undefined) {
  if (source === "env") return "环境变量";
  if (source === "file") return "本地配置";
  return "未配置";
}

export function DeepSeekSettingsPanel({ open, pending, settings, onSave, onCancel }: DeepSeekSettingsPanelProps) {
  const [baseUrl, setBaseUrl] = useState("https://api.deepseek.com");
  const [model, setModel] = useState("deepseek-chat");

  useEffect(() => {
    if (!open) return;
    setBaseUrl(settings?.baseUrl ?? "https://api.deepseek.com");
    setModel(settings?.model ?? "deepseek-chat");
  }, [open, settings?.baseUrl, settings?.model]);

  if (!open) return null;

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSave({
      apiKey: String(formData.get("apiKey") ?? "").trim(),
      baseUrl: String(formData.get("baseUrl") ?? "").trim(),
      model: String(formData.get("model") ?? "").trim()
    });
  }

  return (
    <section className="settings-panel" aria-label="DeepSeek 设置">
      <form onSubmit={submit}>
        <header>
          <strong>DeepSeek 设置</strong>
          <span>{settings?.configured ? `已配置：${sourceLabel(settings.apiKeySource)}` : "未配置"}</span>
        </header>
        <label>
          API Key
          <input name="apiKey" type="password" autoComplete="off" placeholder={settings?.configured ? "已保存；留空则保持现有 key" : "请输入 DeepSeek API key"} disabled={pending} />
        </label>
        <label>
          Base URL
          <input name="baseUrl" value={baseUrl} onInput={(event) => setBaseUrl((event.currentTarget as HTMLInputElement).value)} disabled={pending} />
        </label>
        <label>
          模型
          <input name="model" value={model} onInput={(event) => setModel((event.currentTarget as HTMLInputElement).value)} disabled={pending} />
        </label>
        <p className="settings-help">保存到：{settings?.configPath ?? "%APPDATA%/cline-desktop-pet/config.json"}</p>
        <footer>
          <button type="button" onClick={onCancel} disabled={pending}>取消</button>
          <button type="submit" disabled={pending}>{pending ? "保存中..." : "保存"}</button>
        </footer>
      </form>
    </section>
  );
}