import { Queue, Worker, Job } from "bullmq";
import RedisConfig from "../config/redis.config";
import { emailService, SendEmailPayload } from "./email.service";
import { envConfig } from "../config/env.config";

export interface EmailJobData extends SendEmailPayload {
    jobId?: string;
    retryCount?: number;
}

class QueueService {
    private emailQueue: Queue;
    private worker: Worker | null = null;
    private readonly QUEUE_NAME = "email-queue";
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 5000;

    constructor() {
        const connection = RedisConfig.getInstance();

        this.emailQueue = new Queue(this.QUEUE_NAME, {
            connection: {
                url: envConfig.REDIS_URL,
                maxRetriesPerRequest: null,
            },
            defaultJobOptions: {
                attempts: this.MAX_RETRIES,
                backoff: {
                    type: "fixed",
                    delay: this.RETRY_DELAY,
                },
                removeOnComplete: {
                    age: 3600,
                    count: 1000,
                },
                removeOnFail: {
                    age: 86400,
                    count: 10000,
                },
            },
        });

        this.initializeWorker();
    }

    private initializeWorker(): void {
        const connection = RedisConfig.getInstance();

        this.worker = new Worker(
            this.QUEUE_NAME,
            async (job: Job<EmailJobData>) => {
                console.log(`🔄 [WORKER] Processing job: ${job.id}`, {
                    to: Array.isArray(job.data.to) ? job.data.to.join(', ') : job.data.to,
                    subject: job.data.subject,
                    attempt: job.attemptsMade + 1
                });

                const result = await emailService.sendEmail(job.data);

                if (!result.success) {
                    console.error(`❌ [WORKER] Job ${job.id} failed:`, result.error);
                    throw new Error(result.error || "Email sending failed");
                }

                console.log(`✅ [WORKER] Job ${job.id} completed successfully`, {
                    messageId: result.messageId
                });

                return result;
            },
            {
                connection: {
                    url: envConfig.REDIS_URL,
                    maxRetriesPerRequest: null,
                },
                concurrency: 5,
                limiter: {
                    max: 10,
                    duration: 1000,
                },
            }
        );

        this.worker.on("completed", (job: Job<EmailJobData>) => {
            const jobData = job.data;
            const recipients = Array.isArray(jobData.to) ? jobData.to.join(", ") : jobData.to;
            console.log(`🎉 [WORKER] Job ${job.id} completed`, {
                to: recipients,
                subject: jobData.subject,
                duration: job.finishedOn && job.processedOn ? job.finishedOn - job.processedOn : 'N/A',
                timestamp: new Date().toISOString()
            });
        });

        this.worker.on("failed", (job: Job<EmailJobData> | undefined, error: Error) => {
            if (job) {
                const jobData = job.data;
                const recipients = Array.isArray(jobData.to) ? jobData.to.join(", ") : jobData.to;
                console.error(`💥 [WORKER] Job ${job.id} failed after ${job.attemptsMade} attempts`, {
                    to: recipients,
                    subject: jobData.subject,
                    error: error.message,
                    timestamp: new Date().toISOString()
                });
            }
        });

        this.worker.on("error", (error: Error) => {
            console.error(`⚠️ [WORKER] Worker error:`, error.message);
        });
    }

    async addEmailJob(emailData: SendEmailPayload): Promise<string> {
        const jobId = `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const jobData: EmailJobData = {
            ...emailData,
            jobId,
        };

        console.log(`📧 [QUEUE] Adding email job: ${jobId}`, {
            to: Array.isArray(emailData.to) ? emailData.to.join(', ') : emailData.to,
            subject: emailData.subject,
            timestamp: new Date().toISOString()
        });

        const job = await this.emailQueue.add("send-email", jobData, {
            jobId,
            attempts: this.MAX_RETRIES,
        });

        console.log(`✅ [QUEUE] Job added successfully: ${job.id}`);
        return job.id || jobId;
    }

    async addBulkEmailJobs(emails: SendEmailPayload[]): Promise<{ jobIds: string[]; total: number }> {
        console.log(`📦 [QUEUE] Adding ${emails.length} bulk email jobs`);
        
        const jobIds: string[] = [];

        for (const email of emails) {
            const jobId = await this.addEmailJob(email);
            jobIds.push(jobId);
        }

        console.log(`✅ [QUEUE] Bulk jobs added: ${jobIds.length} total`);
        return {
            jobIds,
            total: jobIds.length,
        };
    }

    async getJobStatus(jobId: string): Promise<{
        status: string;
        data?: any;
        error?: string;
        attempts?: number;
    }> {
        console.log(`🔍 [QUEUE] Getting status for job: ${jobId}`);
        const job = await this.emailQueue.getJob(jobId);

        if (!job) {
            console.log(`❌ [QUEUE] Job ${jobId} not found`);
            return { status: "not_found" };
        }

        const state = await job.getState();
        const result = {
            status: state,
            attempts: job.attemptsMade,
        };

        if (state === "completed") {
            const returnValue = job.returnvalue;
            console.log(`✅ [QUEUE] Job ${jobId} is completed`);
            return { ...result, data: returnValue };
        }

        if (state === "failed") {
            const error = job.failedReason;
            console.log(`❌ [QUEUE] Job ${jobId} failed:`, error);
            return { ...result, error: error || undefined };
        }

        console.log(`📊 [QUEUE] Job ${jobId} status: ${state}`);
        return result;
    }

    async getQueueStats(): Promise<{
        waiting: number;
        active: number;
        completed: number;
        failed: number;
        delayed: number;
    }> {
        console.log(`📊 [QUEUE] Fetching queue stats`);
        const [waiting, active, completed, failed, delayed] = await Promise.all([
            this.emailQueue.getWaitingCount(),
            this.emailQueue.getActiveCount(),
            this.emailQueue.getCompletedCount(),
            this.emailQueue.getFailedCount(),
            this.emailQueue.getDelayedCount(),
        ]);

        console.log(`📊 [QUEUE] Stats: waiting=${waiting}, active=${active}, completed=${completed}, failed=${failed}, delayed=${delayed}`);
        return {
            waiting,
            active,
            completed,
            failed,
            delayed,
        };
    }

    async cleanup(): Promise<void> {
        console.log(`🧹 [QUEUE] Cleaning up queue`);
        await this.emailQueue.obliterate({ force: true });
        console.log(`✅ [QUEUE] Queue cleaned up`);
    }

    async close(): Promise<void> {
        console.log(`🔒 [QUEUE] Closing queue`);
        await this.worker?.close();
        await this.emailQueue.close();
        console.log(`✅ [QUEUE] Queue closed`);
    }
}

export default new QueueService();