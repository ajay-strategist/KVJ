import { createToken } from '../registry';
import { type Result, Ok, Err, AppError } from '../result';
import type { UUID } from '../types';

export interface ScheduledJob {
  id: string;
  name: string;
  type: 'one_time' | 'cron';
  scheduledTime: string; // ISO date string, or simple interval like 'every_5_mins'
  action: () => Promise<void> | void;
  status: 'active' | 'completed' | 'failed';
  lastRun?: string;
  nextRun?: string;
}

export interface ISchedulerEngine {
  scheduleJob(job: Omit<ScheduledJob, 'status'>): Promise<Result<ScheduledJob>>;
  cancelJob(jobId: string): Promise<Result<void>>;
  listJobs(): ScheduledJob[];
  tick(): Promise<void>;
}

export const SCHEDULER_ENGINE_TOKEN = createToken<ISchedulerEngine>('SchedulerEngine');

export class SchedulerEngine implements ISchedulerEngine {
  private jobs = new Map<string, ScheduledJob>();
  private tickInterval: any;

  constructor() {
    // Start automated scheduler tick loop (every 30 seconds)
    this.tickInterval = setInterval(() => {
      this.tick();
    }, 30000);
  }

  async scheduleJob(job: Omit<ScheduledJob, 'status'>): Promise<Result<ScheduledJob>> {
    const scheduled: ScheduledJob = {
      ...job,
      status: 'active',
    };
    this.jobs.set(scheduled.id, scheduled);
    return Ok(scheduled);
  }

  async cancelJob(jobId: string): Promise<Result<void>> {
    const job = this.jobs.get(jobId);
    if (!job) return Err(AppError.notFound('Job not found.'));

    job.status = 'completed';
    this.jobs.delete(jobId);
    return Ok(undefined);
  }

  listJobs(): ScheduledJob[] {
    return [...this.jobs.values()];
  }

  async tick(): Promise<void> {
    const now = new Date();
    for (const job of this.jobs.values()) {
      if (job.status !== 'active') continue;

      let shouldExecute = false;

      if (job.type === 'one_time') {
        const sched = new Date(job.scheduledTime);
        if (sched <= now) {
          shouldExecute = true;
        }
      } else if (job.type === 'cron') {
        // Mock interval parsing for testing cron executions
        if (job.scheduledTime === 'every_minute') {
          shouldExecute = !job.lastRun || (now.getTime() - new Date(job.lastRun).getTime()) >= 60000;
        } else {
          // Standard check (every 5 mins mock fallback)
          shouldExecute = !job.lastRun || (now.getTime() - new Date(job.lastRun).getTime()) >= 300000;
        }
      }

      if (shouldExecute) {
        try {
          console.log(`[Scheduler Engine] Running job "${job.name}" (${job.id})`);
          job.lastRun = now.toISOString();
          await job.action();
          if (job.type === 'one_time') {
            job.status = 'completed';
          }
        } catch (e) {
          console.error(`[Scheduler Engine] Error executing job ${job.id}:`, e);
          job.status = 'failed';
        }
      }
    }
  }

  shutdown(): void {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
  }
}
