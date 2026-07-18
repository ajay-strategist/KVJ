/**
 * KVJ Analytics — Default roles (Prompt 5)
 * Layer: Shared/Permissions. Roles are DATA, not code branches — future custom
 * roles are added without code changes (Prompt 5 requirement).
 *
 * The 12 default roles from Prompt 5. `level` gives a coarse hierarchy used for
 * "manager sees team" style scoping and escalation ordering; it is NOT a
 * substitute for explicit permissions (see permissions.ts).
 */

export type RoleKey =
  | 'SUPER_ADMIN'
  | 'CEO'
  | 'OPERATIONS_MANAGER'
  | 'HR'
  | 'FINANCE'
  | 'LEAD_TRAINER'
  | 'TRAINER'
  | 'ASSISTANT_TRAINER'
  | 'MARKETING_EXECUTIVE'
  | 'PROJECT_SUPERVISOR'
  | 'EMPLOYEE'
  | 'INTERN';

export interface RoleDef {
  key: RoleKey;
  name: string;
  level: number; // higher = broader authority (for scoping/escalation only)
  isSystem: boolean; // system roles cannot be deleted
  workspace: 'employee' | 'supervisor' | 'manager' | 'ceo'; // default landing workspace
  description: string;
}

export const ROLES: Record<RoleKey, RoleDef> = {
  SUPER_ADMIN:        { key: 'SUPER_ADMIN', name: 'Super Administrator', level: 100, isSystem: true, workspace: 'ceo',        description: 'Full platform access and configuration.' },
  CEO:                { key: 'CEO', name: 'CEO', level: 90, isSystem: true, workspace: 'ceo',                                  description: 'Executive oversight and analytics.' },
  OPERATIONS_MANAGER: { key: 'OPERATIONS_MANAGER', name: 'Operations Manager', level: 80, isSystem: true, workspace: 'manager', description: 'Cross-team operations and approvals.' },
  HR:                 { key: 'HR', name: 'HR', level: 70, isSystem: true, workspace: 'manager',                                description: 'People operations: attendance, leave, employees.' },
  FINANCE:            { key: 'FINANCE', name: 'Finance', level: 70, isSystem: true, workspace: 'manager',                      description: 'Expenses, payroll, budgets, vendors.' },
  LEAD_TRAINER:       { key: 'LEAD_TRAINER', name: 'Lead Trainer', level: 60, isSystem: true, workspace: 'supervisor',         description: 'Owns training delivery and trainer team.' },
  PROJECT_SUPERVISOR: { key: 'PROJECT_SUPERVISOR', name: 'Project Supervisor', level: 60, isSystem: true, workspace: 'supervisor', description: 'Plans, assigns and reviews project work.' },
  TRAINER:            { key: 'TRAINER', name: 'Trainer', level: 50, isSystem: true, workspace: 'employee',                     description: 'Delivers training sessions and assessments.' },
  ASSISTANT_TRAINER:  { key: 'ASSISTANT_TRAINER', name: 'Assistant Trainer', level: 40, isSystem: true, workspace: 'employee', description: 'Supports training delivery.' },
  MARKETING_EXECUTIVE:{ key: 'MARKETING_EXECUTIVE', name: 'Marketing Executive', level: 40, isSystem: true, workspace: 'employee', description: 'Runs marketing activities and campaigns.' },
  EMPLOYEE:           { key: 'EMPLOYEE', name: 'Employee', level: 30, isSystem: true, workspace: 'employee',                   description: 'Standard staff member.' },
  INTERN:             { key: 'INTERN', name: 'Intern', level: 20, isSystem: true, workspace: 'employee',                       description: 'Limited-access trainee.' },
};

export const ALL_ROLE_KEYS = Object.keys(ROLES) as RoleKey[];
