import { PetStatus, toStatusLabel } from "../../shared/statuses";

export type PetViewProps = { status: PetStatus; task: string; updatedAt: string; imageSrc: string; onDiagnose(): void };

export function PetView({ status, task, updatedAt, imageSrc, onDiagnose }: PetViewProps) {
  return <main className="pet-shell"><section className="drag-region pet-stage"><img className="pet-image" src={imageSrc} alt={toStatusLabel(status)} draggable={false}/></section><section className="bubble-panel"><strong>{toStatusLabel(status)}</strong><span>{task || "No active task（暂无任务）"}</span><small>Updated（更新）: {updatedAt || "never（从未）"}</small><button type="button" onClick={onDiagnose}>Diagnose（诊断）</button></section></main>;
}