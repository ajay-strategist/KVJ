/**
 * Re-exporting TaskFormModal as CreateTaskModal for backward compatibility.
 * All views now use the single-source-of-truth TaskFormModal with:
 * - Mandatory Estimated Hours
 * - Due Date minimum = Today (no backdating)
 * - Supervisor hierarchy (Project Supervisor for project tasks, Assignor for peer tasks)
 */
export { TaskFormModal as CreateTaskModal, TaskFormModal } from '../forms/TaskFormModal';
export type { TaskFormModalProps as CreateTaskModalProps } from '../forms/TaskFormModal';
export { default } from '../forms/TaskFormModal';
